import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateOfferFields } from "../utils/validation.js";
import { calculateOfferTotals } from "../utils/calculation.js";
import { canTransitionOfferStatus, getOfferParticipants, normalizeOfferStatus, serializePaymentMethods, syncParticipantAmounts, validatePaymentConfiguration } from "../utils/offer-policy.js";

const router = Router();

/*
=========================================================
ADMIN AUTHENTICATION
=========================================================
*/

router.use(requireAuth);
router.use(requireRole("admin"));


/*
=========================================================
DASHBOARD STATISTICS
=========================================================
*/

router.get("/stats", (req, res) => {
  try {
    const totalUsers = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM users
      `)
      .get().total;

    const totalOffers = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM offers
      `)
      .get().total;

    const activeOffers = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM offers
        WHERE status = 'OPEN'
      `)
      .get().total;

    const participants = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM offer_participants
      `)
      .get().total;

    const activeUsers = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM users
        WHERE account_status = 'active'
      `)
      .get().total;

    return res.json({
      totalUsers,
      totalOffers,
      activeOffers,
      participants,
      activeUsers
    });

  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);

    return res.status(500).json({
      error: "Failed to load dashboard statistics."
    });
  }
});


/*
=========================================================
GET ALL OFFERS
=========================================================
*/

router.get("/offers", (req, res) => {
  try {
    const offers = db.prepare(`
      SELECT o.*, users.full_name AS creator_name, users.email AS creator_email,
        (SELECT COUNT(*) FROM offer_participants WHERE offer_id = o.id) AS participant_count
      FROM offers o
      JOIN users ON users.id = o.user_id
      ORDER BY o.created_at DESC
    `).all();

    return res.json({
      success: true,
      offers: offers.map((offer) => ({
        ...offer,
        status: normalizeOfferStatus(offer.status)
      }))
    });
  } catch (error) {
    console.error("ADMIN GET OFFERS ERROR:", error);
    return res.status(500).json({ success: false, error: "Failed to load offers." });
  }
});

router.get("/offers/:id", (req, res) => {
  const offerId = Number(req.params.id);
  if (!Number.isInteger(offerId) || offerId <= 0) {
    return res.status(400).json({ success: false, error: "Invalid offer ID." });
  }

  try {
    const offer = db.prepare(`
      SELECT o.*, users.full_name AS creator_name, users.email AS creator_email
      FROM offers o
      JOIN users ON users.id = o.user_id
      WHERE o.id = ?
    `).get(offerId);

    if (!offer) return res.status(404).json({ success: false, error: "Offer not found." });

    const participants = getOfferParticipants(offerId);
    return res.json({
      success: true,
      offer: {
        ...offer,
        status: normalizeOfferStatus(offer.status),
        participant_count: participants.length,
        totals: calculateOfferTotals(offer, participants)
      },
      participants
    });
  } catch (error) {
    console.error("ADMIN GET OFFER ERROR:", error);
    return res.status(500).json({ success: false, error: "Failed to load offer." });
  }
});

router.put("/offers/:id", (req, res) => {
  const offerId = Number(req.params.id);
  if (!Number.isInteger(offerId) || offerId <= 0) {
    return res.status(400).json({ success: false, error: "Invalid offer ID." });
  }

  const body = req.body || {};
  const restaurantName = body.restaurantName;
  const foodName = body.foodName;
  const foodDescription = body.foodDescription ?? body.description;
  const quantity = body.quantity;
  const foodPrice = body.foodPrice ?? body.price;
  const deliveryCharge = body.deliveryCharge;
  const startTime = body.startTime;
  const endTime = body.endTime;
  const maxPeople = body.maxPeople ?? body.maxParticipants;
  const paymentMethods = body.paymentMethods;

  const fieldError = validateOfferFields({
    restaurantName, foodName, foodDescription, quantity, foodPrice,
    deliveryCharge, startTime, endTime, maxPeople
  });
  if (fieldError) return res.status(400).json({ success: false, error: fieldError });

  const payment = validatePaymentConfiguration(paymentMethods);
  if (payment.error) return res.status(400).json({ success: false, error: payment.error });

  try {
    const result = db.transaction(() => {
      const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      if (!offer) {
        const e = new Error("Offer not found."); e.status = 404; throw e;
      }

      const currentStatus = normalizeOfferStatus(offer.status);
      if (!["OPEN", "DISABLED"].includes(currentStatus)) {
        const e = new Error("Only OPEN or DISABLED offers can be edited by an admin.");
        e.status = 400; throw e;
      }

      const participantCount = db.prepare(`
        SELECT COUNT(*) AS total FROM offer_participants WHERE offer_id = ?
      `).get(offerId).total;

      if (Number(maxPeople) < Number(participantCount)) {
        const e = new Error(
          "Maximum participants cannot be less than the " + participantCount + " participant(s) already joined."
        );
        e.status = 400; throw e;
      }

      const creator = db.prepare(`SELECT full_name FROM users WHERE id = ?`).get(offer.user_id);
      if (!creator) {
        const e = new Error("Offer creator not found."); e.status = 409; throw e;
      }

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
      `).run(
        String(restaurantName).trim(),
        String(foodName).trim(),
        typeof foodDescription === "string" ? foodDescription.trim() || null : null,
        Number(quantity),
        Number(foodPrice),
        Number(deliveryCharge),
        startTime,
        endTime,
        Number(maxPeople),
        serializePaymentMethods(payment),
        payment.bkashEnabled ? 1 : 0,
        payment.bkashEnabled ? payment.bkashNumber : null,
        payment.cityBankEnabled ? 1 : 0,
        payment.cityBankEnabled ? payment.accountName || null : null,
        payment.cityBankEnabled ? payment.accountNumber || null : null,
        payment.cityBankEnabled ? payment.phoneNumber || null : null,
        payment.cashEnabled ? 1 : 0,
        payment.cashEnabled ? creator.full_name : null,
        offerId
      );

      const updated = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      const participants = getOfferParticipants(offerId);
      syncParticipantAmounts(updated, participants);
      const refreshed = getOfferParticipants(offerId);

      return {
        offer: {
          ...updated,
          status: normalizeOfferStatus(updated.status),
          participant_count: refreshed.length,
          totals: calculateOfferTotals(updated, refreshed)
        }
      };
    })();

    return res.json({ success: true, message: "Offer updated successfully.", ...result });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ success: false, error: error.message });
    console.error("ADMIN UPDATE OFFER ERROR:", error);
    return res.status(500).json({ success: false, error: "Failed to update offer." });
  }
});

router.patch("/offers/:id/status", (req, res) => {
  const offerId = Number(req.params.id);
  const requested = normalizeOfferStatus(req.body?.status);

  if (!Number.isInteger(offerId) || offerId <= 0) {
    return res.status(400).json({ success: false, error: "Invalid offer ID." });
  }
  if (!["OPEN", "ENDED", "COMPLETED", "DISMISSED", "DISABLED", "SUCCESSFUL"].includes(requested)) {
    return res.status(400).json({ success: false, error: "Invalid offer status." });
  }

  try {
    const result = db.transaction(() => {
      const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      if (!offer) {
        const e = new Error("Offer not found."); e.status = 404; throw e;
      }

      const current = normalizeOfferStatus(offer.status);
      if (!canTransitionOfferStatus(current, requested)) {
        const e = new Error("Invalid offer status transition from " + current + " to " + requested + ".");
        e.status = 400; throw e;
      }

      db.prepare(`
        UPDATE offers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(requested, offerId);

      return { status: requested };
    })();

    return res.json({ success: true, message: "Offer status changed to " + result.status + ".", ...result });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ success: false, error: error.message });
    console.error("ADMIN STATUS ERROR:", error);
    return res.status(500).json({ success: false, error: "Failed to change offer status." });
  }
});

router.delete("/offers/:id", (req, res) => {
  const offerId = Number(req.params.id);
  if (!Number.isInteger(offerId) || offerId <= 0) {
    return res.status(400).json({ success: false, error: "Invalid offer ID." });
  }

  try {
    const result = db.transaction(() => {
      const offer = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId);
      if (!offer) {
        const e = new Error("Offer not found."); e.status = 404; throw e;
      }

      const current = normalizeOfferStatus(offer.status);
      if (current === "DISMISSED") {
        return { status: current, message: "Offer is already cancelled." };
      }
      if (!canTransitionOfferStatus(current, "DISMISSED")) {
        const e = new Error("This offer cannot be cancelled from its current status.");
        e.status = 400; throw e;
      }

      db.prepare(`
        UPDATE offers SET status = 'DISMISSED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(offerId);

      return {
        status: "DISMISSED",
        message: "Offer cancelled successfully. Participant records were preserved."
      };
    })();

    return res.json({ success: true, ...result });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ success: false, error: error.message });
    console.error("ADMIN DELETE OFFER ERROR:", error);
    return res.status(500).json({ success: false, error: "Failed to cancel offer." });
  }
});

/*
=========================================================
GET ALL USERS
=========================================================
*/

router.get("/users", (req, res) => {

  try {

    const users = db.prepare(`
      SELECT
        id,
        full_name,
        email,
        office_name,
        profile_picture,
        email_verified,
        account_status,
        role,
        created_at,
        last_login
      FROM users
      ORDER BY created_at DESC
    `).all();

    return res.json({
      success: true,
      users
    });

  } catch (error) {
    console.error("ADMIN GET USERS ERROR:", error);

    return res.status(500).json({
      error: "Failed to load users."
    });
  }
});


/*
=========================================================
GET SINGLE USER
=========================================================
*/

router.get("/users/:id", (req, res) => {

  const userId = Number(req.params.id);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({
      error: "Invalid user ID."
    });
  }

  try {

    const user = db.prepare(`
      SELECT
        id,
        full_name,
        email,
        office_name,
        profile_picture,
        email_verified,
        account_status,
        role,
        created_at,
        last_login
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    const offerCount = db.prepare(`
      SELECT COUNT(*) AS total
      FROM offers
      WHERE user_id = ?
    `).get(userId).total;

    const joinedCount = db.prepare(`
      SELECT COUNT(*) AS total
      FROM offer_participants
      WHERE user_id = ?
    `).get(userId).total;

    return res.json({
      success: true,
      user,
      offerCount,
      joinedCount
    });

  } catch (error) {
    console.error("ADMIN GET USER ERROR:", error);

    return res.status(500).json({
      error: "Failed to load user."
    });
  }
});


/*
=========================================================
CHANGE USER STATUS
=========================================================
*/

router.patch("/users/:id/status", (req, res) => {

  const userId = Number(req.params.id);
  const { accountStatus } = req.body;

  const allowedStatuses = [
    "active",
    "banned"
  ];

  if (!Number.isInteger(userId)) {
    return res.status(400).json({
      error: "Invalid user ID."
    });
  }

  if (!allowedStatuses.includes(accountStatus)) {
    return res.status(400).json({
      error: "Invalid account status."
    });
  }

  /*
   * Prevent admin from banning themselves.
   */

  if (
    userId === Number(req.user.id) &&
    accountStatus === "banned"
  ) {
    return res.status(400).json({
      error: "You cannot ban your own account."
    });
  }

  try {

    const user = db.prepare(`
      SELECT id
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    db.prepare(`
      UPDATE users
      SET account_status = ?
      WHERE id = ?
    `).run(accountStatus, userId);

    return res.json({
      success: true,
      message: `User ${accountStatus === "active" ? "enabled" : "banned"} successfully.`
    });

  } catch (error) {
    console.error("ADMIN USER STATUS ERROR:", error);

    return res.status(500).json({
      error: "Failed to update user status."
    });
  }
});


/*
=========================================================
DELETE USER
=========================================================
*/

router.delete("/users/:id", (req, res) => {

  const userId = Number(req.params.id);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({
      error: "Invalid user ID."
    });
  }

  /*
   * Prevent admin from deleting themselves.
   */

  if (userId === Number(req.user.id)) {
    return res.status(400).json({
      error: "You cannot delete your own admin account."
    });
  }

  try {

    const user = db.prepare(`
      SELECT id, role
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    /*
     * Prevent deleting another admin.
     */

    if (user.role === "admin") {
      return res.status(403).json({
        error: "Admin accounts cannot be deleted from this panel."
      });
    }

    db.prepare(`
      DELETE FROM users
      WHERE id = ?
    `).run(userId);

    return res.json({
      success: true,
      message: "User deleted successfully."
    });

  } catch (error) {
    console.error("ADMIN DELETE USER ERROR:", error);

    return res.status(500).json({
      error: "Failed to delete user."
    });
  }
});


/*
=========================================================
RECENT ACTIVITY
=========================================================
*/

router.get("/activity", (req, res) => {

  try {

    /*
     * We don't have an activity_logs table yet.
     * So for now we generate useful activity
     * from users and offers.
     */

    const activity = db.prepare(`
      SELECT *
      FROM (

        SELECT
          'offer_created' AS type,
          'New offer created' AS title,
          food_name AS description,
          created_at AS created_at
        FROM offers

        UNION ALL

        SELECT
          'user_registered' AS type,
          'New user registered' AS title,
          full_name AS description,
          created_at AS created_at
        FROM users

      )

      ORDER BY created_at DESC
      LIMIT 20
    `).all();

    return res.json({
      success: true,
      activity
    });

  } catch (error) {
    console.error("ADMIN ACTIVITY ERROR:", error);

    return res.status(500).json({
      error: "Failed to load activity."
    });
  }
});


export default router;