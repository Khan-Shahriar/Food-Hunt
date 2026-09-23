import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateOfferFields } from "../utils/validation.js";
import { calculateOfferTotals } from "../utils/calculation.js";
import {
  canTransitionOfferStatus,
  getAllowedPaymentMethods,
  getOfferParticipants,
  normalizeOfferStatus,
  serializePaymentMethods,
  syncParticipantAmounts,
  validatePaymentConfiguration
} from "../utils/offer-policy.js";

const router = express.Router();

function parseOfferId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateOfferPayload(body) {
  const {
    restaurantName, foodName, foodDescription, quantity, foodPrice,
    deliveryCharge, startTime, endTime, maxPeople, paymentMethods
  } = body;

  const fieldError = validateOfferFields({
    restaurantName, foodName, foodDescription, quantity, foodPrice,
    deliveryCharge, startTime, endTime, maxPeople
  });
  if (fieldError) return { error: fieldError };

  const payment = validatePaymentConfiguration(paymentMethods);
  if (payment.error) return payment;

  return {
    restaurantName: restaurantName.trim(),
    foodName: foodName.trim(),
    foodDescription: typeof foodDescription === "string"
      ? foodDescription.trim() || null
      : null,
    quantity: Number(quantity),
    foodPrice: Number(foodPrice),
    deliveryCharge: Number(deliveryCharge),
    startTime,
    endTime,
    maxPeople: Number(maxPeople),
    payment
  };
}

function buildOfferWriteValues(payload, creatorName) {
  const p = payload.payment;
  return [
    payload.restaurantName, payload.foodName, payload.foodDescription,
    payload.quantity, payload.foodPrice, payload.deliveryCharge,
    payload.startTime, payload.endTime, payload.maxPeople,
    serializePaymentMethods(p),
    p.bkashEnabled ? 1 : 0,
    p.bkashEnabled ? p.bkashNumber : null,
    p.cityBankEnabled ? 1 : 0,
    p.cityBankEnabled ? p.accountName || null : null,
    p.cityBankEnabled ? p.accountNumber || null : null,
    p.cityBankEnabled ? p.phoneNumber || null : null,
    p.cashEnabled ? 1 : 0,
    p.cashEnabled ? creatorName : null
  ];
}

/*
 * Create Offer
 */
router.post("/", requireAuth, (req, res) => {
  const payload = validateOfferPayload(req.body || {});
  if (payload.error) {
    return res.status(400).json({ success: false, message: payload.error });
  }

  try {
    const creator = db.prepare(`
      SELECT id, full_name, account_status
      FROM users
      WHERE id = ?
    `).get(req.user.id);

    if (!creator) {
      return res.status(401).json({ success: false, message: "Authenticated user not found." });
    }
    if (creator.account_status !== "active") {
      return res.status(403).json({ success: false, message: "Your account is not active." });
    }

    const result = db.prepare(`
      INSERT INTO offers (
        user_id, restaurant_name, food_name, food_description,
        quantity, food_price, delivery_charge, start_time, end_time,
        max_people, payment_methods, payment_bkash_enabled, bkash_number,
        payment_citybank_enabled, citybank_account_name, citybank_account_number,
        citybank_phone, payment_cash_enabled, cash_account_name, status, updated_at
      )
      VALUES (
        ?,?,?,?,?,?,?,?,?,?,
        ?,?,?,
        ?,?,?,?,
        ?,?,
        'OPEN',
        CURRENT_TIMESTAMP
      )
    `).run(req.user.id, ...buildOfferWriteValues(payload, creator.full_name));

    const offer = db.prepare(`
      SELECT * FROM offers WHERE id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: "Offer created successfully.",
      offer
    });
  } catch (error) {
    console.error("CREATE OFFER ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to create offer." });
  }
});

/*
 * Get active offers.
 */
router.get("/", requireAuth, (req, res) => {
  try {
    db.prepare(`
      UPDATE offers
      SET status = 'ENDED', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'OPEN'
      AND datetime(end_time) <= datetime('now')
    `).run();

    const offers = db.prepare(`
      SELECT
        o.*,
        u.full_name,
        (
          SELECT COUNT(*) FROM offer_participants op
          WHERE op.offer_id = o.id
        ) AS participant_count,
        EXISTS(
          SELECT 1 FROM offer_participants op
          WHERE op.offer_id = o.id AND op.user_id = ?
        ) AS joined
      FROM offers o
      JOIN users u ON u.id = o.user_id
      WHERE o.status = 'OPEN'
      ORDER BY o.created_at DESC
    `).all(req.user.id);

    return res.json(offers);
  } catch (error) {
    console.error("GET OFFERS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to load offers." });
  }
});

/*
 * Join Offer. Eligibility and insertion are one SQLite write transaction.
 */
router.post("/:id/join", requireAuth, (req, res) => {
  const offerId = parseOfferId(req.params.id);
  const userId = Number(req.user.id);
  const { paymentMethod } = req.body || {};

  if (!offerId) return res.status(400).json({ success: false, message: "Invalid offer ID." });
  if (!["bkash", "city_bank", "cash"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "Invalid payment method." });
  }

  try {
    const result = db.transaction(() => {
      const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      if (!offer) {
        const e = new Error("Offer not found."); e.status = 404; throw e;
      }

      if (normalizeOfferStatus(offer.status) !== "OPEN") {
        const e = new Error("This offer is no longer available."); e.status = 400; throw e;
      }

      if (new Date(offer.end_time).getTime() <= Date.now()) {
        db.prepare(`UPDATE offers SET status = 'ENDED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(offerId);
        const e = new Error("This offer has already ended."); e.status = 400; throw e;
      }

      const duplicate = db.prepare(`
        SELECT id FROM offer_participants WHERE offer_id = ? AND user_id = ?
      `).get(offerId, userId);
      if (duplicate) {
        const e = new Error("You already joined this order."); e.status = 409; throw e;
      }

      const participantCount = db.prepare(`
        SELECT COUNT(*) AS total FROM offer_participants WHERE offer_id = ?
      `).get(offerId).total;
      if (participantCount >= Number(offer.max_people)) {
        const e = new Error("This order is already full."); e.status = 409; throw e;
      }

      if (!getAllowedPaymentMethods(offer).includes(paymentMethod)) {
        const e = new Error("Selected payment method is not available for this offer.");
        e.status = 400; throw e;
      }

      const amount = calculateOfferTotals(offer, []).costPerPerson;
      const participant = db.prepare(`
        INSERT INTO offer_participants (offer_id, user_id, payment_method, amount)
        VALUES (?, ?, ?, ?)
        RETURNING id, offer_id, user_id, joined_at, food_received, received_at,
                  payment_method, amount
      `).get(offerId, userId, paymentMethod, amount);

      const participants = getOfferParticipants(offerId);
      return {
        participant,
        participantCount: participants.length,
        totals: calculateOfferTotals(offer, participants)
      };
    })();

    return res.status(201).json({ success: true, message: "Joined successfully.", ...result });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
    if (String(error?.code || "").includes("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ success: false, message: "You already joined this order." });
    }
    console.error("JOIN OFFER ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to join order." });
  }
});

/*
 * Leave Offer.
 */
router.delete("/:id/leave", requireAuth, (req, res) => {
  const offerId = parseOfferId(req.params.id);
  if (!offerId) return res.status(400).json({ success: false, message: "Invalid offer ID." });

  try {
    const result = db.transaction(() => {
      const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      if (!offer) { const e = new Error("Offer not found."); e.status = 404; throw e; }
      if (normalizeOfferStatus(offer.status) !== "OPEN") {
        const e = new Error("You can only leave an active offer."); e.status = 400; throw e;
      }

      const participant = db.prepare(`
        SELECT id FROM offer_participants WHERE offer_id = ? AND user_id = ?
      `).get(offerId, req.user.id);
      if (!participant) {
        const e = new Error("You are not a participant in this offer."); e.status = 404; throw e;
      }

      db.prepare(`DELETE FROM offer_participants WHERE id = ?`).run(participant.id);

      const participants = getOfferParticipants(offerId);
      syncParticipantAmounts(offer, participants);
      const updatedParticipants = getOfferParticipants(offerId);

      return {
        participantCount: updatedParticipants.length,
        totals: calculateOfferTotals(offer, updatedParticipants)
      };
    })();

    return res.json({ success: true, message: "You left the offer successfully.", ...result });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("LEAVE OFFER ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to leave offer." });
  }
});

/*
 * Get Single Offer. Creator or participant only.
 */
router.get("/:id", requireAuth, (req, res) => {
  const offerId = parseOfferId(req.params.id);
  if (!offerId) return res.status(400).json({ success: false, message: "Invalid offer ID." });

  try {
    const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found." });

    const isCreator = offer.user_id === req.user.id;
    const isParticipant = Boolean(db.prepare(`
      SELECT 1 FROM offer_participants WHERE offer_id = ? AND user_id = ?
    `).get(offerId, req.user.id));

    if (!isCreator && !isParticipant) {
      return res.status(403).json({ success: false, message: "You do not have access to this offer." });
    }

    const participants = getOfferParticipants(offerId);
    return res.json({
      success: true,
      offer: {
        ...offer,
        status: normalizeOfferStatus(offer.status),
        participant_count: participants.length,
        joined: isParticipant,
        totals: calculateOfferTotals(offer, participants)
      }
    });
  } catch (error) {
    console.error("GET SINGLE OFFER ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to load offer." });
  }
});

/*
 * Edit Offer. Offer and participant amounts are updated atomically.
 */
router.patch("/:id", requireAuth, (req, res) => {
  const offerId = parseOfferId(req.params.id);
  if (!offerId) return res.status(400).json({ success: false, message: "Invalid offer ID." });

  const payload = validateOfferPayload(req.body || {});
  if (payload.error) return res.status(400).json({ success: false, message: payload.error });

  try {
    const result = db.transaction(() => {
      const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      if (!offer) { const e = new Error("Offer not found."); e.status = 404; throw e; }
      if (offer.user_id !== req.user.id) {
        const e = new Error("Only the creator can edit this offer."); e.status = 403; throw e;
      }
      if (normalizeOfferStatus(offer.status) !== "OPEN") {
        const e = new Error("Only active offers can be edited."); e.status = 400; throw e;
      }

      const participantCount = db.prepare(`
        SELECT COUNT(*) AS total FROM offer_participants WHERE offer_id = ?
      `).get(offerId).total;
      if (payload.maxPeople < Number(participantCount)) {
        const e = new Error(
          "Maximum people cannot be less than the " + participantCount + " participant(s) already joined."
        );
        e.status = 400; throw e;
      }

      const creator = db.prepare(`SELECT full_name FROM users WHERE id = ?`).get(req.user.id);
      if (!creator) { const e = new Error("Authenticated user not found."); e.status = 401; throw e; }

      db.prepare(`
        UPDATE offers SET
          restaurant_name = ?, food_name = ?, food_description = ?,
          quantity = ?, food_price = ?, delivery_charge = ?,
          start_time = ?, end_time = ?, max_people = ?,
          payment_methods = ?, payment_bkash_enabled = ?, bkash_number = ?,
          payment_citybank_enabled = ?, citybank_account_name = ?,
          citybank_account_number = ?, citybank_phone = ?,
          payment_cash_enabled = ?, cash_account_name = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(...buildOfferWriteValues(payload, creator.full_name), offerId);

      const updatedOffer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      const participants = getOfferParticipants(offerId);
      syncParticipantAmounts(updatedOffer, participants);
      const updatedParticipants = getOfferParticipants(offerId);

      return {
        offer: {
          ...updatedOffer,
          status: normalizeOfferStatus(updatedOffer.status),
          participant_count: updatedParticipants.length,
          totals: calculateOfferTotals(updatedOffer, updatedParticipants)
        }
      };
    })();

    return res.json({ success: true, message: "Offer updated successfully.", ...result });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("UPDATE OFFER ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update offer." });
  }
});

/*
 * Get Offer Participants.
 */
router.get("/:id/participants", requireAuth, (req, res) => {
  const offerId = parseOfferId(req.params.id);
  if (!offerId) return res.status(400).json({ success: false, message: "Invalid offer ID." });

  try {
    const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found." });

    const isCreator = offer.user_id === req.user.id;
    const isParticipant = Boolean(db.prepare(`
      SELECT 1 FROM offer_participants WHERE offer_id = ? AND user_id = ?
    `).get(offerId, req.user.id));

    if (!isCreator && !isParticipant) {
      return res.status(403).json({ success: false, message: "You do not have access to this offer." });
    }

    const participants = getOfferParticipants(offerId);
    return res.json({
      success: true,
      participants,
      totals: calculateOfferTotals(offer, participants)
    });
  } catch (error) {
    console.error("GET PARTICIPANTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to load participants." });
  }
});

/*
 * Creator lifecycle actions.
 */
router.post("/:id/complete", requireAuth, (req, res) =>
  changeCreatorStatus(req, res, "COMPLETED")
);
router.post("/:id/dismiss", requireAuth, (req, res) =>
  changeCreatorStatus(req, res, "DISMISSED")
);
router.post("/:id/end", requireAuth, (req, res) =>
  changeCreatorStatus(req, res, "ENDED")
);
router.delete("/:id", requireAuth, (req, res) =>
  changeCreatorStatus(req, res, "DISMISSED", true)
);

function changeCreatorStatus(req, res, targetStatus, deleteAlias = false) {
  const offerId = parseOfferId(req.params.id);
  if (!offerId) return res.status(400).json({ success: false, message: "Invalid offer ID." });

  try {
    const result = db.transaction(() => {
      const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      if (!offer) { const e = new Error("Offer not found."); e.status = 404; throw e; }
      if (offer.user_id !== req.user.id) {
        const e = new Error("Only the creator can manage this offer."); e.status = 403; throw e;
      }

      const current = normalizeOfferStatus(offer.status);
      if (!canTransitionOfferStatus(current, targetStatus)) {
        const e = new Error("Offer cannot change from " + current + " to " + targetStatus + ".");
        e.status = 400; throw e;
      }

      db.prepare(`
        UPDATE offers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(targetStatus, offerId);

      const participants = getOfferParticipants(offerId);
      return {
        status: targetStatus,
        participantCount: participants.length,
        totals: calculateOfferTotals(offer, participants),
        message: deleteAlias ? "Offer cancelled successfully." : "Offer status changed to " + targetStatus + "."
      };
    })();

    return res.json({ success: true, ...result });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("CHANGE OFFER STATUS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to change offer status." });
  }
});

/*
 * Mark Participant Food Received.
 */
router.patch("/:id/participants/:userId/received", requireAuth, (req, res) => {
  const offerId = parseOfferId(req.params.id);
  const participantUserId = Number(req.params.userId);

  if (!offerId || !Number.isInteger(participantUserId) || participantUserId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid participant reference." });
  }

  try {
    const result = db.transaction(() => {
      const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      if (!offer) { const e = new Error("Offer not found."); e.status = 404; throw e; }
      if (offer.user_id !== req.user.id) {
        const e = new Error("Only the creator can update food status."); e.status = 403; throw e;
      }

      const participant = db.prepare(`
        SELECT * FROM offer_participants WHERE offer_id = ? AND user_id = ?
      `).get(offerId, participantUserId);
      if (!participant) { const e = new Error("Participant not found."); e.status = 404; throw e; }

      const received = req.body?.received === true;
      db.prepare(`
        UPDATE offer_participants
        SET food_received = ?, received_at = ?
        WHERE offer_id = ? AND user_id = ?
      `).run(received ? 1 : 0, received ? new Date().toISOString() : null, offerId, participantUserId);

      const totals = db.prepare(`
        SELECT COUNT(*) AS total, COALESCE(SUM(food_received), 0) AS received
        FROM offer_participants WHERE offer_id = ?
      `).get(offerId);

      let successful = false;
      if (
        received &&
        Number(totals.total) > 0 &&
        Number(totals.received) === Number(totals.total) &&
        normalizeOfferStatus(offer.status) === "COMPLETED"
      ) {
        db.prepare(`
          UPDATE offers SET status = 'SUCCESSFUL', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(offerId);
        successful = true;
      }

      const updatedOffer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      return { status: normalizeOfferStatus(updatedOffer.status), successful };
    })();

    return res.json({
      success: true,
      ...result,
      message: req.body?.received === true ? "Food marked as received." : "Food marked as not received."
    });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("FOOD RECEIVED ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update food status." });
  }
});

export default router;
