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
                users.full_name
            FROM offers
            JOIN users
            ON offers.user_id = users.id
            ORDER BY offers.created_at DESC
        `).all();

        res.json(offers);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Failed to load offers."
        });

    }

});
export default router;