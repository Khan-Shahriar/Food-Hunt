import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

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
      SELECT
        offers.*,

        users.full_name AS creator_name,
        users.email AS creator_email,

        (
          SELECT COUNT(*)
          FROM offer_participants
          WHERE offer_participants.offer_id = offers.id
        ) AS participant_count

      FROM offers

      JOIN users
        ON offers.user_id = users.id

      ORDER BY offers.created_at DESC
    `).all();

    return res.json({
      success: true,
      offers
    });

  } catch (error) {
    console.error("ADMIN GET OFFERS ERROR:", error);

    return res.status(500).json({
      error: "Failed to load offers."
    });
  }
});


/*
=========================================================
GET SINGLE OFFER
=========================================================
*/

router.get("/offers/:id", (req, res) => {

  const offerId = Number(req.params.id);

  if (!Number.isInteger(offerId)) {
    return res.status(400).json({
      error: "Invalid offer ID."
    });
  }

  try {

    const offer = db.prepare(`
      SELECT
        offers.*,
        users.full_name AS creator_name,
        users.email AS creator_email,

        (
          SELECT COUNT(*)
          FROM offer_participants
          WHERE offer_participants.offer_id = offers.id
        ) AS participant_count

      FROM offers

      JOIN users
        ON offers.user_id = users.id

      WHERE offers.id = ?
    `).get(offerId);

    if (!offer) {
      return res.status(404).json({
        error: "Offer not found."
      });
    }

    return res.json({
      success: true,
      offer
    });

  } catch (error) {
    console.error("ADMIN GET OFFER ERROR:", error);

    return res.status(500).json({
      error: "Failed to load offer."
    });
  }
});


/*
=========================================================
EDIT OFFER
=========================================================
*/

router.put("/offers/:id", (req, res) => {

  const offerId = Number(req.params.id);

  if (!Number.isInteger(offerId)) {
    return res.status(400).json({
      error: "Invalid offer ID."
    });
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
    maxPeople
  } = req.body;

  if (
    !restaurantName?.trim() ||
    !foodName?.trim()
  ) {
    return res.status(400).json({
      error: "Restaurant name and food name are required."
    });
  }

  if (Number(quantity) <= 0) {
    return res.status(400).json({
      error: "Quantity must be greater than zero."
    });
  }

  if (Number(foodPrice) < 0) {
    return res.status(400).json({
      error: "Food price cannot be negative."
    });
  }

  if (Number(deliveryCharge) < 0) {
    return res.status(400).json({
      error: "Delivery charge cannot be negative."
    });
  }

  if (Number(maxPeople) <= 0) {
    return res.status(400).json({
      error: "Maximum participants must be greater than zero."
    });
  }

  try {

    const existing = db
      .prepare(`
        SELECT id
        FROM offers
        WHERE id = ?
      `)
      .get(offerId);

    if (!existing) {
      return res.status(404).json({
        error: "Offer not found."
      });
    }

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
        max_people = ?

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
      offerId
    );

    const updatedOffer = db
      .prepare(`
        SELECT *
        FROM offers
        WHERE id = ?
      `)
      .get(offerId);

    return res.json({
      success: true,
      message: "Offer updated successfully.",
      offer: updatedOffer
    });

  } catch (error) {
    console.error("ADMIN UPDATE OFFER ERROR:", error);

    return res.status(500).json({
      error: "Failed to update offer."
    });
  }
});


/*
=========================================================
CHANGE OFFER STATUS
=========================================================
*/

router.patch("/offers/:id/status", (req, res) => {

  const offerId = Number(req.params.id);
  const { status } = req.body;

  const allowedStatuses = [
    "OPEN",
    "CLOSED",
    "DISABLED"
  ];

  if (!Number.isInteger(offerId)) {
    return res.status(400).json({
      error: "Invalid offer ID."
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid offer status."
    });
  }

  try {

    const offer = db
      .prepare(`
        SELECT id
        FROM offers
        WHERE id = ?
      `)
      .get(offerId);

    if (!offer) {
      return res.status(404).json({
        error: "Offer not found."
      });
    }

    db.prepare(`
      UPDATE offers
      SET status = ?
      WHERE id = ?
    `).run(status, offerId);

    return res.json({
      success: true,
      message: `Offer status changed to ${status}.`
    });

  } catch (error) {
    console.error("ADMIN STATUS ERROR:", error);

    return res.status(500).json({
      error: "Failed to change offer status."
    });
  }
});


/*
=========================================================
DELETE OFFER
=========================================================
*/

router.delete("/offers/:id", (req, res) => {

  const offerId = Number(req.params.id);

  if (!Number.isInteger(offerId)) {
    return res.status(400).json({
      error: "Invalid offer ID."
    });
  }

  try {

    const offer = db
      .prepare(`
        SELECT id
        FROM offers
        WHERE id = ?
      `)
      .get(offerId);

    if (!offer) {
      return res.status(404).json({
        error: "Offer not found."
      });
    }

    /*
     * Because foreign_keys = ON in db.js,
     * participants will also be removed automatically.
     */

    db.prepare(`
      DELETE FROM offers
      WHERE id = ?
    `).run(offerId);

    return res.json({
      success: true,
      message: "Offer deleted successfully."
    });

  } catch (error) {
    console.error("ADMIN DELETE OFFER ERROR:", error);

    return res.status(500).json({
      error: "Failed to delete offer."
    });
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