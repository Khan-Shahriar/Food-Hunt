import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { clearAuthCookie, requireAuth } from "../middleware/auth.js";
import { isValidEmail, validatePassword } from "../utils/validation.js";

const router = Router();

function sanitizeUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    officeName: row.office_name,
    profilePicture: row.profile_picture,
    emailVerified: Boolean(row.email_verified),
    accountStatus: row.account_status,
    role: row.role,
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };
}

router.get("/profile", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);
  return res.json({ user: sanitizeUser(user) });
});

router.put("/profile", requireAuth, (req, res) => {
  const { fullName, email, profilePicture } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);

  if (!fullName?.trim()) {
    return res.status(400).json({ error: "Full name is required." });
  }

  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const nextEmail = (email || user.email).trim().toLowerCase();
  const duplicate = db
    .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?")
    .get(nextEmail, user.id);

  if (duplicate) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  db.prepare(
    `UPDATE users
     SET full_name = ?, email = ?, profile_picture = ?, email_verified = CASE WHEN email = ? THEN email_verified ELSE 0 END
     WHERE id = ?`,
  ).run(fullName.trim(), nextEmail, profilePicture || null, nextEmail, user.id);

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  return res.json({
    user: sanitizeUser(updated),
    message: nextEmail !== user.email ? "Email updated. Please verify your new email." : "Profile updated.",
  });
});

router.put("/password", requireAuth, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);

  if (!bcrypt.compareSync(currentPassword || "", user.password_hash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, user.id);

  return res.json({ message: "Password changed successfully." });
});

router.delete("/account", requireAuth, (req, res) => {
  const { password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);

  if (!bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Password is incorrect." });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  clearAuthCookie(res);

  return res.json({ message: "Account deleted successfully." });
});

export default router;
