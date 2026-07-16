import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dataDir = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "foodhunt.db");

console.log("Database path:", dbPath);

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    office_name TEXT,
    profile_picture TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    account_status TEXT NOT NULL DEFAULT 'active',
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
  );

  CREATE TABLE IF NOT EXISTS verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,

    restaurant_name TEXT NOT NULL,
    food_name TEXT NOT NULL,
    food_description TEXT,

    quantity INTEGER NOT NULL,
    food_price REAL NOT NULL,
    delivery_charge REAL NOT NULL,

    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,

    max_people INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'OPEN',

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offer_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    offer_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,

    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (offer_id)
    REFERENCES offers(id)
    ON DELETE CASCADE,

    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_verification_token ON verification_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token);

  CREATE INDEX IF NOT EXISTS idx_offers_user
  ON offers(user_id);

  CREATE INDEX IF NOT EXISTS idx_offer_participants_offer
  ON offer_participants(offer_id);
`);

export default db;
