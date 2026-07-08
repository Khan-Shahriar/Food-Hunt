import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

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
        maxPeople
    } = req.body;

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
                max_people
            )
            VALUES
            (?,?,?,?,?,?,?,?,?,?)
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
            maxPeople
        );

        return res.json({
            success: true,
            offerId: result.lastInsertRowid,
            message: "Offer created successfully."
        });

    } catch (err) {

        console.error(err);

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

        console.error(err);

        res.status(500).json({
            message: "Failed to load offers."
        });

    }

});

/*
 * Join Offer
 */

router.post("/:id/join", requireAuth, (req, res) => {

    const offerId = Number(req.params.id);
    const userId = req.user.id;

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

        const alreadyJoined = db.prepare(`
            SELECT id
            FROM offer_participants
            WHERE offer_id = ?
            AND user_id = ?
        `).get(offerId, userId);

        if (alreadyJoined) {
            return res.status(400).json({
                message: "You already joined this order."
            });
        }

        db.prepare(`
            INSERT INTO offer_participants
            (
                offer_id,
                user_id
            )
            VALUES
            (?,?)
        `).run(offerId, userId);

        res.json({
            success: true,
            message: "Joined successfully.",
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