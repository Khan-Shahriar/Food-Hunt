import db from "./db.js";

console.log(
    db.prepare("PRAGMA table_info(offers)").all()
);

db.close();