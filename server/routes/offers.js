import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
    validateOfferFields,
    validatePaymentMethods
} from "../utils/validation.js";

import { calculateOfferTotals } from "../utils/calculation.js";

const router = express.Router();

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
        return res.status(400).json({
            success: false,
            message: validationError
        });
    }

    const paymentValidationError =
        validatePaymentMethods(paymentMethods);

    if (paymentValidationError) {
        return res.status(400).json({
            success: false,
            message: paymentValidationError
        });
    }

    const selectedPayments = paymentMethods;

    const bkashEnabled =
        selectedPayments.bkash?.enabled === true;

    const cityBankEnabled =
        selectedPayments.cityBank?.enabled === true;

    const cashEnabled =
        selectedPayments.cash?.enabled === true;


    /*
     * Validate bKash.
     */
    if (
        bkashEnabled &&
        !selectedPayments.bkash?.number?.trim()
    ) {

        return res.status(400).json({
            success: false,
            message: "bKash number is required."
        });

    }


    /*
     * Validate City Bank.
     *
     * Account Name + Account Number
     * OR
     * Phone Number
     */
    if (cityBankEnabled) {

        const accountName =
            selectedPayments.cityBank?.accountName?.trim() || "";

        const accountNumber =
            selectedPayments.cityBank?.accountNumber?.trim() || "";

        const phoneNumber =
            selectedPayments.cityBank?.phoneNumber?.trim() || "";

        const hasAccountDetails =
            accountName !== "" &&
            accountNumber !== "";

        const hasPhone =
            phoneNumber !== "";

        if (!hasAccountDetails && !hasPhone) {

            return res.status(400).json({
                success: false,
                message:
                    "For City Bank, provide Account Name + Account Number OR Phone Number."
            });

        }

    }


    /*
     * Get creator from authenticated user.
     *
     * The frontend cannot control the Cash account name.
     */
    const creator = db.prepare(`
        SELECT full_name
        FROM users
        WHERE id = ?
    `).get(req.user.id);


    if (!creator) {

        return res.status(401).json({
            success: false,
            message: "Authenticated user not found."
        });

    }


    try {

        const stmt = db.prepare(`
            INSERT INTO offers
            (
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
            VALUES
            (
                ?,?,?,?,?,?,?,?,?,?,
                ?,
                ?,?,
                ?,?,?,?,
                ?,?
            )
        `);


        const result = stmt.run(

            req.user.id,

            restaurantName,
            foodName,
            foodDescription,

            quantity,
            foodPrice,
            deliveryCharge,

            startTime,
            endTime,

            maxPeople,

            JSON.stringify(
                [
                    ...(bkashEnabled ? ["bkash"] : []),
                    ...(cityBankEnabled ? ["city_bank"] : []),
                    ...(cashEnabled ? ["cash"] : [])
                ]
            ),



            /*=========================
             * bKash
             ==========================*/
            bkashEnabled ? 1 : 0,

            bkashEnabled
                ? selectedPayments.bkash.number.trim()
                : null,


            /*
             * City Bank
             */
            cityBankEnabled ? 1 : 0,

            cityBankEnabled
                ? selectedPayments.cityBank.accountName?.trim() || null
                : null,

            cityBankEnabled
                ? selectedPayments.cityBank.accountNumber?.trim() || null
                : null,

            cityBankEnabled
                ? selectedPayments.cityBank.phoneNumber?.trim() || null
                : null,


            /*
             * Cash
             */
            cashEnabled ? 1 : 0,

            cashEnabled
                ? creator.full_name
                : null



        );


        return res.json({

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
 * Get All Open Offers
 */

router.get("/", requireAuth, (req, res) => {

    try {

        const offers = db.prepare(`
            SELECT
    offers.*,
    users.full_name,

    (
        SELECT COUNT(*)
        FROM offer_participants
        WHERE offer_participants.offer_id = offers.id
    ) AS participant_count,

    EXISTS(
        SELECT 1
        FROM offer_participants
        WHERE offer_id = offers.id
        AND user_id = ?
    ) AS joined

FROM offers

JOIN users
ON offers.user_id = users.id

ORDER BY offers.created_at DESC
        `).all(req.user.id);

        res.json(offers);

    } catch (err) {

        console.error("CREATE OFFER ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

/*
 * Join Offer
 */

router.post("/:id/join", requireAuth, (req, res) => {

    const offerId = Number(req.params.id);
    const userId = req.user.id;

    const { paymentMethod } = req.body;

    if (!["bkash", "city_bank", "cash"].includes(paymentMethod)) {
        return res.status(400).json({
            success: false,
            message: "Invalid payment method."
        });
    }

    try {

        const offer = db.prepare(`
            SELECT *
            FROM offers
            WHERE id = ?
        `).get(offerId);

        if (!offer) {
            return res.status(404).json({
                message: "Offer not found."
            });
        }

        if (offer.status !== "OPEN") {
            return res.status(400).json({
                message: "This offer is no longer available."
            });
        }

        if (new Date(offer.end_time).getTime() <= Date.now()) {

            db.prepare(`
                UPDATE offers
                SET status = 'ENDED'
                WHERE id = ?
            `).run(offerId);

            return res.status(400).json({
                message: "This offer has already ended."
            });
        }

        const participantCount = db.prepare(`
            SELECT COUNT(*) AS total
            FROM offer_participants
            WHERE offer_id = ?
        `).get(offerId).total;

        if (participantCount >= offer.max_people) {
            return res.status(400).json({
                message: "This order is already full."
            });
        }


        const allowedPaymentMethods = [];

        if (offer.payment_bkash_enabled === 1) {
            allowedPaymentMethods.push("bkash");
        }

        if (offer.payment_citybank_enabled === 1) {
            allowedPaymentMethods.push("city_bank");
        }

        if (offer.payment_cash_enabled === 1) {
            allowedPaymentMethods.push("cash");
        }

        if (!allowedPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                message: "Selected payment method is not available for this offer."
            });
        }

        const alreadyJoined = db.prepare(`
            SELECT id
            FROM offer_participants
            WHERE offer_id = ?
            AND user_id = ?
        `).get(offerId, userId);

        if (alreadyJoined) {
            return res.status(409).json({
                success: false,
                message: "You already joined this order."
            });
        }

        const totals = calculateOfferTotals(
            {
                foodPrice: offer.food_price,
                deliveryCharge: offer.delivery_charge,
                maxPeople: offer.max_people
            },
            []
        );

        const costPerPerson = totals.costPerPerson;

        db.prepare(`
            INSERT INTO offer_participants
            (
                offer_id,
                user_id,
                payment_method,
                amount
            )
            VALUES
            (?, ?, ?, ?)
        `).run(
            offerId,
            userId,
            paymentMethod,
            costPerPerson
        );

        return res.json({
            success: true,
            message: "Joined successfully.",
            participant: {
                offerId: offerId,
                userId: userId,
                paymentMethod: paymentMethod,
                amount: costPerPerson
            },
            participantCount: participantCount + 1
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Failed to join order."
        });

    }

});

export default router;

/*
 * Get Offer Participants
 */
router.get("/:id/participants", requireAuth, (req, res) => {

    const offerId = Number(req.params.id);

    try {

        const offer = db.prepare(`
            SELECT *
            FROM offers
            WHERE id = ?
        `).get(offerId);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found."
            });
        }

        // Only the creator can manage participants.
        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the offer creator can view participants."
            });
        }

        const participants = db.prepare(`
            SELECT
                offer_participants.user_id,
                users.full_name,
                users.profile_picture,
                offer_participants.joined_at,
                offer_participants.food_received,
                offer_participants.received_at,
                offer_participants.payment_method,
                offer_participants.amount

            FROM offer_participants

            JOIN users
            ON users.id = offer_participants.user_id

            WHERE offer_participants.offer_id = ?

            ORDER BY offer_participants.joined_at ASC
        `).all(offerId);

        const totals = calculateOfferTotals(
            {
                foodPrice: offer.food_price,
                deliveryCharge: offer.delivery_charge,
                maxPeople: offer.max_people
            },
            participants
        );

        return res.json({
            success: true,
            participants,
            totals
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
 * Complete Offer
 */
router.post("/:id/complete", requireAuth, (req, res) => {

    const offerId = Number(req.params.id);

    try {

        const offer = db.prepare(`
            SELECT *
            FROM offers
            WHERE id = ?
        `).get(offerId);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found."
            });
        }

        /*
         * Only the creator can complete the offer.
         */
        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can complete this offer."
            });
        }

        /*
         * Do not require the offer to be full.
         *
         * Example:
         * max_people = 8
         * joined = 5
         *
         * The creator can still complete it.
         */

        if (offer.status !== "OPEN") {
            return res.status(400).json({
                success: false,
                message: "This offer is no longer active."
            });
        }

        db.prepare(`
            UPDATE offers
            SET
                status = 'completed',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(offerId);

        return res.json({
            success: true,
            message: "Offer completed successfully."
        });

    } catch (err) {

        console.error("COMPLETE OFFER ERROR:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to complete offer."
        });

    }

});


/*
 * Dismiss Offer
 */
router.post("/:id/dismiss", requireAuth, (req, res) => {

    const offerId = Number(req.params.id);

    try {

        const offer = db.prepare(`
            SELECT *
            FROM offers
            WHERE id = ?
        `).get(offerId);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found."
            });
        }

        /*
         * Only the creator can dismiss the offer.
         */
        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can dismiss this offer."
            });
        }

        /*
         * Only an active offer can be dismissed.
         */
        if (offer.status !== "OPEN") {
            return res.status(400).json({
                success: false,
                message: "This offer is no longer active."
            });
        }

        db.prepare(`
            UPDATE offers
            SET
                status = 'dismissed',
                updated_at = CURRENT_TIMESTAMP
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

    const offerId = Number(req.params.id);

    try {

        const offer = db.prepare(`
            SELECT *
            FROM offers
            WHERE id = ?
        `).get(offerId);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found."
            });
        }

        if (offer.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Only the creator can end this offer."
            });
        }

        if (offer.status !== "OPEN") {
            return res.status(400).json({
                success: false,
                message: "This offer is no longer active."
            });
        }

        db.prepare(`
            UPDATE offers
            SET status = 'ENDED'
            WHERE id = ?
        `).run(offerId);

        return res.json({
            success: true,
            message: "Offer ended successfully."
        });

    } catch (err) {

        console.error("END OFFER ERROR:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to end offer."
        });

    }

});


/*
 * Mark Participant Food Received
 */
router.patch(
    "/:id/participants/:userId/received",
    requireAuth,
    (req, res) => {

        const offerId = Number(req.params.id);
        const participantUserId = Number(req.params.userId);

        try {

            const offer = db.prepare(`
                SELECT *
                FROM offers
                WHERE id = ?
            `).get(offerId);

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

            const participant = db.prepare(`
                SELECT *
                FROM offer_participants
                WHERE offer_id = ?
                AND user_id = ?
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
                    received_at = ?
                WHERE offer_id = ?
                AND user_id = ?
            `).run(
                received ? 1 : 0,
                received ? new Date().toISOString() : null,
                offerId,
                participantUserId
            );

            /*
             * Check whether everyone received their food.
             */
            const totals = db.prepare(`
                SELECT
                    COUNT(*) AS total,
                    SUM(food_received) AS received
                FROM offer_participants
                WHERE offer_id = ?
            `).get(offerId);

            let successful = false;

            if (
                totals.total > 0 &&
                Number(totals.received) === Number(totals.total)
            ) {

                db.prepare(`
                    UPDATE offers
                    SET status = 'SUCCESSFUL'
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

    }
);