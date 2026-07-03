import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken,
} from "../middleware/auth.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/email.js";
import { validateLogin, validatePassword, validateSignup } from "../utils/validation.js";

const router = Router();
const APP_URL = process.env.APP_URL || "http://localhost:8080";
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function sanitizeUser(row) {
  if (!row) {
    return null;
  }

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

function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email.trim());
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function isAccountLocked(user) {
  if (!user.locked_until) {
    return false;
  }

  return new Date(user.locked_until) > new Date();
}

router.post("/signup", (req, res) => {
  console.log("Signup request received");
  const { fullName, officeName, email, password, confirmPassword } = req.body;
  const validationError = validateSignup({
    fullName,
    officeName,
    email,
    password,
    confirmPassword,
  });

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const existing = getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare(
      `INSERT INTO users (full_name, email, password_hash, office_name)
       VALUES (?, ?, ?, ?)`,
    )
    .run(fullName.trim(), email.trim().toLowerCase(), passwordHash, officeName.trim());

  const userId = result.lastInsertRowid;
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
  ).run(userId, token, expiresAt);

  sendVerificationEmail(email, fullName.trim(), `${APP_URL}/?verify=${token}`);

  return res.status(201).json({
    message: "Please verify your email.",
    verifyUrl: `${APP_URL}/?verify=${token}`,
  });
});

router.post("/login", (req, res) => {
  const { email, password, rememberMe = false } = req.body;
  const validationError = validateLogin({ email, password });

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const user = getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (isAccountLocked(user)) {
    return res.status(423).json({
      error: "Account temporarily locked after too many failed attempts. Try again later.",
    });
  }

  if (user.account_status === "banned") {
    return res.status(403).json({ error: "This account has been banned." });
  }

  const passwordOk = bcrypt.compareSync(password, user.password_hash);
  if (!passwordOk) {
    const attempts = user.failed_login_attempts + 1;
    let lockedUntil = null;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
    }

    db.prepare(
      `UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`,
    ).run(attempts, lockedUntil, user.id);

    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (!user.email_verified) {
    return res.status(403).json({
      error: "Please verify your email before logging in.",
    });
  }

  db.prepare(
    `UPDATE users
     SET failed_login_attempts = 0, locked_until = NULL, last_login = datetime('now')
     WHERE id = ?`,
  ).run(user.id);

  const token = signToken(user, rememberMe);
  setAuthCookie(res, token, rememberMe);

  return res.json({
    message: "Login successful.",
    user: sanitizeUser(getUserById(user.id)),
  });
});

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.json({ message: "Logged out successfully." });
});

router.get("/me", requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);

  if (!user || user.account_status === "banned") {
    clearAuthCookie(res);
    return res.status(403).json({ error: "Account unavailable." });
  }

  return res.json({ user: sanitizeUser(user) });
});

router.get("/verify-email", (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: "Verification token is required." });
  }

  const record = db
    .prepare("SELECT * FROM verification_tokens WHERE token = ?")
    .get(String(token));

  if (!record) {
    return res.status(400).json({ error: "Invalid or expired verification link." });
  }

  if (new Date(record.expires_at) < new Date()) {
    db.prepare("DELETE FROM verification_tokens WHERE id = ?").run(record.id);
    return res.status(400).json({ error: "Verification link has expired." });
  }

  db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(record.user_id);
  db.prepare("DELETE FROM verification_tokens WHERE user_id = ?").run(record.user_id);

  return res.json({ message: "Email verified successfully. You can now log in." });
});

router.post("/forgot-password", (req, res) => {
  const email = req.body.email?.trim();

  if (!email) {
    return res.status(400).json({ error: "Please enter your email address." });
  }

  const user = getUserByEmail(email);
  if (user) {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(user.id);
    db.prepare(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
    ).run(user.id, token, expiresAt);

    sendPasswordResetEmail(user.email, user.full_name, `${APP_URL}/?reset=${token}`);
  }

  return res.json({
    message: "If an account exists for that email, a reset link has been sent.",
  });
});

router.post("/reset-password", (req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Reset token is required." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const record = db
    .prepare("SELECT * FROM password_reset_tokens WHERE token = ?")
    .get(String(token));

  if (!record || new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: "Invalid or expired reset link." });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, record.user_id);
  db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(record.user_id);
  db.prepare(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`,
  ).run(record.user_id);

  return res.json({ message: "Password updated successfully. You can now log in." });
});

export default router;
