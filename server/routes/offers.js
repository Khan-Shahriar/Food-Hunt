import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
    validateOfferFields,
    validatePaymentMethods,
    validatePaymentMethod
} from "../utils/validation.js";
import { calculateOfferTotals, roundMoney } from "../utils/calculation.js";

const router = express.Router();

const ALLOWED_PAYMENT_METHODS = new Set(["bkash", "city_bank", "cash"]);

function parseOfferId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function getOffer(offerId) {
    return db.prepare("SELECT * FROM offers WHERE id = ?").get(offerId);
}

function getParticipants(offerId) {
    return db.prepare(`
        SELECT
            offer_participants.id,
            offer_participants.offer_id,
            offer_participants.user_id,
            users.full_name,
            users.profile_picture,
            offer_participants.joined_at,
            offer_participants.food_received,
            offer_participants.received_at,
            offer_participants.payment_method,
            offer_participants.payment_status,
            offer_participants.order_status,
            offer_participants.amount,
            offer_participants.updated_at
        FROM offer_participants
        JOIN users ON users.id = offer_participants.user_id
        WHERE offer_participants.offer_id = ?
        ORDER BY offer_participants.joined_at ASC
    `).all(offerId);
}

function allowedPaymentMethodsForOffer(offer) {
    const methods = [];

    if (Number(offer.payment_bkash_enabled) === 1) methods.push("bkash");
    if (Number(offer.payment_citybank_enabled) === 1) methods.push("city_bank");
    if (Number(offer.payment_cash_enabled) === 1) methods.push("cash");

    return methods;
}

function paymentPayload(paymentMethods) {
    return {
        bkash: {
            enabled: paymentMethods?.bkash?.enabled === true,
            number: paymentMethods?.bkash?.number?.trim() || ""
        },
        cityBank: {
            enabled: paymentMethods?.cityBank?.enabled === true,
            accountName: paymentMethods?.cityBank?.accountName?.trim() || "",
            accountNumber: paymentMethods?.cityBank?.accountNumber?.trim() || "",
            phoneNumber: paymentMethods?.cityBank?.phoneNumber?.trim() || ""
        },
        cash: {
            enabled: paymentMethods?.cash?.enabled === true
        }
    };
}

function validatePaymentDetails(paymentMethods) {
    const selected = paymentPayload(paymentMethods);

    const validationError = validatePaymentMethods(selected);
    if (validationError) return validationError;

    if (selected.bkash.enabled && !selected.bkash.number) {
        return "bKash number is required.";
    }

    if (selected.cityBank.enabled) {
        const hasAccountDetails =
            Boolean(selected.cityBank.accountName) &&
            Boolean(selected.cityBank.accountNumber);

        const hasPhone = Boolean(selected.cityBank.phoneNumber);

        if (!hasAccountDetails && !hasPhone) {
            return "For City Bank, provide Account Name + Account Number OR Phone Number.";
        }
    }

    return "";
}

function paymentColumns(paymentMethods) {
    const selected = paymentPayload(paymentMethods);

    return {
        paymentMethods: JSON.stringify([
            ...(selected.bkash.enabled ? ["bkash"] : []),
            ...(selected.cityBank.enabled ? ["city_bank"] : []),
            ...(selected.cash.enabled ? ["cash"] : [])
        ]),
        payment_bkash_enabled: selected.bkash.enabled ? 1 : 0,
        bkash_number: selected.bkash.enabled ? selected.bkash.number : null,
        payment_citybank_enabled: selected.cityBank.enabled ? 1 : 0,
        citybank_account_name: selected.cityBank.enabled
            ? selected.cityBank.accountName || null
            : null,
        citybank_account_number: selected.cityBank.enabled
            ? selected.cityBank.accountNumber || null
            : null,
        citybank_phone: selected.cityBank.enabled
            ? selected.cityBank.phoneNumber || null
            : null,
        payment_cash_enabled: selected.cash.enabled ? 1 : 0
    };
}

function safeOffer(offer) {
    return {
        id: offer.id,
        user_id: offer.user_id,
        restaurant_name: offer.restaurant_name,
        food_name: offer.food_name,
        food_description: offer.food_description,
        quantity: offer.quantity,
        food_price: offer.food_price,
        delivery_charge: offer.delivery_charge,
        start_time: offer.start_time,
        end_time: offer.end_time,
        max_people: offer.max_people,
        status: offer.status,
        created_at: offer.created_at,
        updated_at: offer.updated_at,
        payment_bkash_enabled: Number(offer.payment_bkash_enabled) === 1,
        payment_citybank_enabled: Number(offer.payment_citybank_enabled) === 1,
        payment_cash_enabled: Number(offer.payment_cash_enabled) === 1,
        participant_count: offer.participant_count
    };
}

function reconcileParticipants(offerId, offer, participants) {
    const totals = calculateOfferTotals(
        {
            foodPrice: offer.food_price,
            deliveryCharge: offer.delivery_charge,
            maxPeople: offer.max_people
        },
        participants
    );

    const updateParticipant = db.prepare(`
        UPDATE offer_participants
        SET amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    for (const participant of participants) {
        if (String(participant.order_status).toUpperCase() === "CANCELLED") {
            continue;
        }

        updateParticipant.run(
            roundMoney(totals.costPerPerson),
            participant.id
        );
    }

    return totals;
}

function finalizeOffer(offerId, status = "COMPLETED") {
    const transaction = db.transaction(() => {
        const offer = getOffer(offerId);

        if (!offer) {
            const error = new Error("Offer not found.");
            error.statusCode = 404;
            throw error;
        }

        if (String(offer.status).toUpperCase() !== "OPEN") {
            const error = new Error("This offer is no longer active.");
            error.statusCode = 400;
            throw error;
        }

        const participants = getParticipants(offerId);

        if (participants.length === 0) {
            const error = new Error("At least one participant is required to finalize an offer.");
            error.statusCode = 400;
            throw error;
        }

        const totals = reconcileParticipants(offerId, offer, participants);
        const now = new Date().toISOString();

        db.prepare(`
            UPDATE offers
            SET
                status = ?,
                final_total = ?,
                final_participant_count = ?,
                finalized_at = ?,
                completed_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            status,
            totals.grandTotal,
            totals.joinedCount,
            now,
            status === "COMPLETED" ? now : offer.completed_at || null,
            offerId
        );

        return {
            totals,
            participantCount: participants.length
        };
    });

    return transaction();
}

/*
 * Create Offer
 */
router.post("/", requireAuth, (req, res) => {
    const {
        restaurantName,
        foodName,
        foodDescription,
        quantity,
        foodPrice,
        deliveryCharge,
        startTime,
        endTime,
        maxPeople,
        paymentMethods
    } = req.body;

    const validationError = validateOfferFields({
        restaurantName,
        foodName,
        foodDescription,
        quantity,
        foodPrice,
        deliveryCharge,
        startTime,
        endTime,
        maxPeople
    });

    if (validationError) {
        return res.status(400).json({ success: false, message: validationError });
    }

    const paymentValidationError = validatePaymentDetails(paymentMethods);
    if (paymentValidationError) {
        return res.status(400).json({ success: false, message: paymentValidationError });
    }

    const creator = db.prepare(
        "SELECT full_name FROM users WHERE id = ?"
    ).get(req.user.id);

    if (!creator) {
        return res.status(401).json({
            success: false,
            message: "Authenticated user not found."
        });
    }

    try {
        const payment = paymentColumns(paymentMethods);

        const result = db.prepare(`
            INSERT INTO offers (
                user_id,
                restaurant_name,
                food_name,
                food_description,
                quantity,
                food_price,
                delivery_charge,
                start_time,
                end_time,
                max_people,
                payment_methods,
                payment_bkash_enabled,
                bkash_number,
                payment_citybank_enabled,
                citybank_account_name,
                citybank_account_number,
                citybank_phone,
                payment_cash_enabled,
                cash_account_name
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            req.user.id,
            restaurantName.trim(),
            foodName.trim(),
            foodDescription?.trim() || null,
            Number(quantity),
            Number(foodPrice),
            Number(deliveryCharge),
            startTime,
            endTime,
            Number(maxPeople),
            payment.paymentMethods,
            payment.payment_bkash_enabled,
            payment.bkash_number,
            payment.payment_citybank_enabled,
            payment.citybank_account_name,
            payment.citybank_account_number,
            payment.citybank_phone,
            payment.payment_cash_enabled,
            payment.payment_cash_enabled ? creator.full_name : null
        );

        return res.status(201).json({
            success: true,
            offerId: result.lastInsertRowid,
            message: "Offer created successfully."
        });
    } catch (err) {
        console.error("CREATE OFFER ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create offer."
        });
    }
});

/*
 * Get Offers
 *
 * Payment account details are intentionally excluded from the list.
 */
router.get("/", requireAuth, (req, res) => {
    try {
        const offers = db.prepare(`
            SELECT
                offers.id,
                offers.user_id,
                offers.restaurant_name,
                offers.food_name,
                offers.food_description,
                offers.quantity,
                offers.food_price,
                offers.delivery_charge,
                offers.start_time,
                offers.end_time,
                offers.max_people,
                offers.status,
                offers.created_at,
                offers.updated_at,
                offers.payment_bkash_enabled,
                offers.payment_citybank_enabled,
                offers.payment_cash_enabled,
                users.full_name,
                (
                    SELECT COUNT(*)
                    FROM offer_participants
                    WHERE offer_participants.offer_id = offers.id
                    AND UPPER(COALESCE(offer_participants.order_status, 'JOINED')) != 'CANCELLED'
                ) AS participant_count,
                EXISTS(
                    SELECT 1
                    FROM offer_participants
                    WHERE offer_id = offers.id
                    AND user_id = ?
                    AND UPPER(COALESCE(order_status, 'JOINED')) != 'CANCELLED'
                ) AS joined
            FROM offers
            JOIN users ON offers.user_id = users.id
            ORDER BY offers.created_at DESC
        `).all(req.user.id);

        return res.json(offers);
    } catch (err) {
        console.error("GET OFFERS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to load offers."
        });
    }
});

/*
 * Join Offer
 */
router.post("/:id/join", requireAuth, (req, res) => {
    const offerId = parseOfferId(req.params.id);
    const userId = req.user.id;
    const { paymentMethod } = req.body;

    if (!offerId) {
        return res.status(400).json({ success: false, message: "Invalid offer ID." });
    }

    const paymentValidationError = validatePaymentMethod(paymentMethod);
    if (paymentValidationError) {
        return res.status(400).json({ success: false, message: paymentValidationError });
    }

    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
        return res.status(400).json({ success: false, message: "Invalid payment method." });
    }

    try {
        const transaction = db.transaction(() => {
            const offer = getOffer(offerId);

            if (!offer) {
                const error = new Error("Offer not found.");
                error.statusCode = 404;
                throw error;
            }

            if (String(offer.status).toUpperCase() !== "OPEN") {
                const error = new Error("This offer is no longer available.");
                error.statusCode = 400;
                throw error;
            }

            if (new Date(offer.end_time).getTime() <= Date.now()) {
                db.prepare(`
                    UPDATE offers
                    SET status = 'ENDED', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND status = 'OPEN'
                `).run(offerId);

                const error = new Error("This offer has already ended.");
                error.statusCode = 400;
                throw error;
            }

            const allowedPaymentMethods = allowedPaymentMethodsForOffer(offer);

            if (!allowedPaymentMethods.includes(paymentMethod)) {
                const error = new Error("Selected payment method is not available for this offer.");
                error.statusCode = 400;
                throw error;
            }

            const participant = db.prepare(`
                SELECT id, order_status
                FROM offer_participants
                WHERE offer_id = ? AND user_id = ?
            `).get(offerId, userId);

            if (participant && String(participant.order_status).toUpperCase() !== "CANCELLED") {
                const error = new Error("You already joined this order.");
                error.statusCode = 409;
                throw error;
            }

            const participantCount = db.prepare(`
                SELECT COUNT(*) AS total
                FROM offer_participants
                WHERE offer_id = ?
                AND UPPER(COALESCE(order_status, 'JOINED')) != 'CANCELLED'
            `).get(offerId).total;

            if (participantCount >= Number(offer.max_people)) {
                const error = new Error("This order is already full.");
                error.statusCode = 409;
                throw error;
            }

            const totals = calculateOfferTotals(
                {
                    foodPrice: offer.food_price,
                    deliveryCharge: offer.delivery_charge,
                    maxPeople: offer.max_people
                },
                Array.from({ length: participantCount + 1 }, () => ({
                    payment_method: paymentMethod,
                    order_status: "JOINED"
                }))
            );

            if (participant && String(participant.order_status).toUpperCase() === "CANCELLED") {
                db.prepare(`
                    UPDATE offer_participants
                    SET
                        payment_method = ?,
                        amount = ?,
                        order_status = 'JOINED',
                        payment_status = 'PENDING',
                        food_received = 0,
                        received_at = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(paymentMethod, totals.costPerPerson, participant.id);
            } else {
                db.prepare(`
                    INSERT INTO offer_participants (
                        offer_id,
                        user_id,
                        payment_method,
                        amount,
                        order_status,
                        payment_status
                    )
                    VALUES (?, ?, ?, ?, 'JOINED', 'PENDING')
                `).run(
                    offerId,
                    userId,
                    paymentMethod,
                    totals.costPerPerson
                );
            }

            return {
                amount: totals.costPerPerson,
                participantCount: participantCount + 1
            };
        });

        const result = transaction();

        return res.status(201).json({
            success: true,
            message: "Joined successfully.",
            participant: {
                offerId,
                userId,
                paymentMethod,
                amount: result.amount,
                orderStatus: "JOINED",
                paymentStatus: "PENDING"
            },
            participantCount: result.participantCount
        });
    } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message: "You already joined this order."
            });
        }

        console.error("JOIN OFFER ERROR:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.statusCode ? err.message : "Failed to join order."
        });
    }
});

/*
 * Get Single Offer
 */
router.get("/:id", requireAuth, (req, res) => {
    const offerId = parseOfferId(req.params.id);

    if (!offerId) {
        return res.status(400).json({ success: false, message: "Invalid offer ID." });
    }

    try {
        const offer = getOffer(offerId);

        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found." });
        }

        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can view this offer."
            });
        }

        return res.json({ success: true, offer });
    } catch (err) {
        console.error("GET SINGLE OFFER ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to load offer."
        });
    }
});

/*
 * Edit Offer
 */
router.patch("/:id", requireAuth, (req, res) => {
    const offerId = parseOfferId(req.params.id);

    if (!offerId) {
        return res.status(400).json({ success: false, message: "Invalid offer ID." });
    }

    const {
        restaurantName,
        foodName,
        foodDescription,
        quantity,
        foodPrice,
        deliveryCharge,
        startTime,
        endTime,
        maxPeople,
        paymentMethods
    } = req.body;

    try {
        const offer = getOffer(offerId);

        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found." });
        }

        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can edit this offer."
            });
        }

        if (String(offer.status).toUpperCase() !== "OPEN") {
            return res.status(400).json({
                success: false,
                message: "Only active offers can be edited."
            });
        }

        const validationError = validateOfferFields({
            restaurantName,
            foodName,
            foodDescription,
            quantity,
            foodPrice,
            deliveryCharge,
            startTime,
            endTime,
            maxPeople
        });

        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const paymentValidationError = validatePaymentDetails(paymentMethods);
        if (paymentValidationError) {
            return res.status(400).json({ success: false, message: paymentValidationError });
        }

        const participants = getParticipants(offerId).filter(
            (participant) =>
                String(participant.order_status).toUpperCase() !== "CANCELLED"
        );

        if (Number(maxPeople) < participants.length) {
            return res.status(400).json({
                success: false,
                message: `Maximum people cannot be less than the ${participants.length} participant(s) already joined.`
            });
        }

        const selectedPaymentMethods = paymentColumns(paymentMethods);
        const allowed = new Set(JSON.parse(selectedPaymentMethods.paymentMethods));

        const incompatible = participants.find(
            (participant) => !allowed.has(participant.payment_method)
        );

        if (incompatible) {
            return res.status(400).json({
                success: false,
                message: "Cannot remove a payment method already selected by a participant."
            });
        }

        const creator = db.prepare(
            "SELECT full_name FROM users WHERE id = ?"
        ).get(req.user.id);

        if (!creator) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found."
            });
        }

        const transaction = db.transaction(() => {
            db.prepare(`
                UPDATE offers
                SET
                    restaurant_name = ?,
                    food_name = ?,
                    food_description = ?,
                    quantity = ?,
                    food_price = ?,
                    delivery_charge = ?,
                    start_time = ?,
                    end_time = ?,
                    max_people = ?,
                    payment_methods = ?,
                    payment_bkash_enabled = ?,
                    bkash_number = ?,
                    payment_citybank_enabled = ?,
                    citybank_account_name = ?,
                    citybank_account_number = ?,
                    citybank_phone = ?,
                    payment_cash_enabled = ?,
                    cash_account_name = ?,
                    final_total = NULL,
                    final_participant_count = NULL,
                    finalized_at = NULL,
                    completed_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                restaurantName.trim(),
                foodName.trim(),
                foodDescription?.trim() || null,
                Number(quantity),
                Number(foodPrice),
                Number(deliveryCharge),
                startTime,
                endTime,
                Number(maxPeople),
                selectedPaymentMethods.paymentMethods,
                selectedPaymentMethods.payment_bkash_enabled,
                selectedPaymentMethods.bkash_number,
                selectedPaymentMethods.payment_citybank_enabled,
                selectedPaymentMethods.citybank_account_name,
                selectedPaymentMethods.citybank_account_number,
                selectedPaymentMethods.citybank_phone,
                selectedPaymentMethods.payment_cash_enabled,
                selectedPaymentMethods.payment_cash_enabled ? creator.full_name : null,
                offerId
            );

            const updatedOffer = getOffer(offerId);
            reconcileParticipants(offerId, updatedOffer, participants);
        });

        transaction();

        return res.json({
            success: true,
            message: "Offer updated successfully.",
            offerId
        });
    } catch (err) {
        console.error("UPDATE OFFER ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update offer."
        });
    }
});

/*
 * Get Offer Participants
 */
router.get("/:id/participants", requireAuth, (req, res) => {
    const offerId = parseOfferId(req.params.id);

    if (!offerId) {
        return res.status(400).json({ success: false, message: "Invalid offer ID." });
    }

    try {
        const offer = getOffer(offerId);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found."
            });
        }

        const isCreator = offer.user_id === req.user.id;

        const isParticipant = db.prepare(`
            SELECT 1
            FROM offer_participants
            WHERE offer_id = ?
            AND user_id = ?
            AND UPPER(COALESCE(order_status, 'JOINED')) != 'CANCELLED'
        `).get(offerId, req.user.id);

        if (!isCreator && !isParticipant) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this offer."
            });
        }

        const participants = getParticipants(offerId);
        const totals = calculateOfferTotals(
            {
                foodPrice: offer.food_price,
                deliveryCharge: offer.delivery_charge,
                maxPeople: offer.max_people
            },
            participants
        );

        const visibleParticipants = participants.map((participant) => {
            if (isCreator || participant.user_id === req.user.id) {
                return participant;
            }

            return {
                id: participant.id,
                offer_id: participant.offer_id,
                user_id: participant.user_id,
                full_name: participant.full_name,
                profile_picture: participant.profile_picture,
                joined_at: participant.joined_at,
                food_received: participant.food_received,
                received_at: participant.received_at,
                order_status: participant.order_status
            };
        });

        return res.json({
            success: true,
            participants: visibleParticipants,
            totals,
            viewer: {
                isCreator,
                userId: req.user.id
            }
        });
    } catch (err) {
        console.error("GET PARTICIPANTS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to load participants."
        });
    }
});

/*
 * Complete / finalize offer.
 */
router.post("/:id/complete", requireAuth, (req, res) => {
    const offerId = parseOfferId(req.params.id);

    if (!offerId) {
        return res.status(400).json({ success: false, message: "Invalid offer ID." });
    }

    try {
        const offer = getOffer(offerId);

        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found." });
        }

        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can complete this offer."
            });
        }

        const result = finalizeOffer(offerId, "COMPLETED");

        return res.json({
            success: true,
            message: "Offer finalized successfully.",
            finalTotal: result.totals.grandTotal,
            participantCount: result.totals.joinedCount,
            paymentTotals: result.totals.paymentTotals
        });
    } catch (err) {
        console.error("COMPLETE OFFER ERROR:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.statusCode ? err.message : "Failed to complete offer."
        });
    }
});

/*
 * Dismiss Offer
 */
router.post("/:id/dismiss", requireAuth, (req, res) => {
    const offerId = parseOfferId(req.params.id);

    if (!offerId) {
        return res.status(400).json({ success: false, message: "Invalid offer ID." });
    }

    try {
        const offer = getOffer(offerId);

        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found." });
        }

        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can dismiss the offer."
            });
        }

        if (String(offer.status).toUpperCase() !== "OPEN") {
            return res.status(400).json({
                success: false,
                message: "This offer is no longer active."
            });
        }

        const participantCount = db.prepare(`
            SELECT COUNT(*) AS total
            FROM offer_participants
            WHERE offer_id = ?
            AND UPPER(COALESCE(order_status, 'JOINED')) != 'CANCELLED'
        `).get(offerId).total;

        if (participantCount > 0) {
            return res.status(409).json({
                success: false,
                message: "An offer with participants cannot be dismissed."
            });
        }

        db.prepare(`
            UPDATE offers
            SET status = 'DISMISSED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(offerId);

        return res.json({
            success: true,
            message: "Offer dismissed successfully."
        });
    } catch (err) {
        console.error("DISMISS OFFER ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to dismiss offer."
        });
    }
});

/*
 * End Offer
 */
router.post("/:id/end", requireAuth, (req, res) => {
    const offerId = parseOfferId(req.params.id);

    if (!offerId) {
        return res.status(400).json({ success: false, message: "Invalid offer ID." });
    }

    try {
        const offer = getOffer(offerId);

        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found." });
        }

        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can end this offer."
            });
        }

        if (String(offer.status).toUpperCase() !== "OPEN") {
            return res.status(400).json({
                success: false,
                message: "This offer is no longer active."
            });
        }

        const participantCount = db.prepare(`
            SELECT COUNT(*) AS total
            FROM offer_participants
            WHERE offer_id = ?
            AND UPPER(COALESCE(order_status, 'JOINED')) != 'CANCELLED'
        `).get(offerId).total;

        if (participantCount > 0) {
            const result = finalizeOffer(offerId, "ENDED");

            return res.json({
                success: true,
                message: "Offer ended and totals finalized.",
                finalTotal: result.totals.grandTotal,
                participantCount: result.totals.joinedCount
            });
        }

        db.prepare(`
            UPDATE offers
            SET status = 'ENDED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(offerId);

        return res.json({
            success: true,
            message: "Offer ended successfully."
        });
    } catch (err) {
        console.error("END OFFER ERROR:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.statusCode ? err.message : "Failed to end offer."
        });
    }
});

/*
 * Mark Participant Food Received
 */
router.patch("/:id/participants/:userId/received", requireAuth, (req, res) => {
    const offerId = parseOfferId(req.params.id);
    const participantUserId = Number(req.params.userId);

    if (!offerId || !Number.isInteger(participantUserId) || participantUserId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid offer or participant ID."
        });
    }

    try {
        const offer = getOffer(offerId);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found."
            });
        }

        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can update food status."
            });
        }

        if (!["COMPLETED", "SUCCESSFUL"].includes(String(offer.status).toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: "The offer must be finalized before food receipt can be recorded."
            });
        }

        const participant = db.prepare(`
            SELECT *
            FROM offer_participants
            WHERE offer_id = ? AND user_id = ?
        `).get(offerId, participantUserId);

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: "Participant not found."
            });
        }

        const received = req.body.received === true;

        db.prepare(`
            UPDATE offer_participants
            SET
                food_received = ?,
                received_at = ?,
                order_status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE offer_id = ? AND user_id = ?
        `).run(
            received ? 1 : 0,
            received ? new Date().toISOString() : null,
            received ? "FULFILLED" : "CONFIRMED",
            offerId,
            participantUserId
        );

        const totals = db.prepare(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN food_received = 1 THEN 1 ELSE 0 END) AS received
            FROM offer_participants
            WHERE offer_id = ?
            AND UPPER(COALESCE(order_status, 'JOINED')) != 'CANCELLED'
        `).get(offerId);

        let successful = false;

        if (
            Number(totals.total) > 0 &&
            Number(totals.received) === Number(totals.total)
        ) {
            db.prepare(`
                UPDATE offers
                SET status = 'SUCCESSFUL', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(offerId);

            successful = true;
        }

        return res.json({
            success: true,
            successful,
            message: received
                ? "Food marked as received."
                : "Food marked as not received."
        });
    } catch (err) {
        console.error("FOOD RECEIVED ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update food status."
        });
    }
});

export default router;
