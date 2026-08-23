import db from "./db.js";

const offers = db.prepare(`
    SELECT
        id,
        restaurant_name,
        payment_methods,
        payment_bkash_enabled,
        bkash_number,
        payment_citybank_enabled,
        citybank_account_name,
        citybank_account_number,
        citybank_phone,
        payment_cash_enabled,
        cash_account_name
    FROM offers
    ORDER BY id DESC
    LIMIT 10
`).all();

console.log(JSON.stringify(offers, null, 2));