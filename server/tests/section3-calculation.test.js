import test from "node:test";
import assert from "node:assert/strict";
import {
    calculateOfferTotals,
    roundMoney
} from "../utils/calculation.js";

test("canonical offer calculation reconciles food and delivery totals", () => {
    const totals = calculateOfferTotals(
        {
            foodPrice: 250,
            deliveryCharge: 100,
            maxPeople: 8
        },
        Array.from({ length: 5 }, (_, index) => ({
            user_id: index + 1,
            payment_method:
                index === 0 || index === 3 ? "bkash" :
                index === 1 ? "city_bank" : "cash",
            order_status: "JOINED"
        }))
    );

    assert.equal(totals.joinedCount, 5);
    assert.equal(totals.deliveryShare, 12.5);
    assert.equal(totals.foodSubtotal, 1250);
    assert.equal(totals.deliveryAllocated, 62.5);
    assert.equal(totals.costPerPerson, 262.5);
    assert.equal(totals.totalAmount, 1312.5);
    assert.equal(totals.grandTotal, 1312.5);
    assert.equal(totals.paymentTotals.bkash, 525);
    assert.equal(totals.paymentTotals.cityBank, 262.5);
    assert.equal(totals.paymentTotals.cash, 525);
    assert.equal(totals.progress, 62.5);
});

test("cancelled orders are excluded from financial totals", () => {
    const totals = calculateOfferTotals(
        {
            foodPrice: 100,
            deliveryCharge: 50,
            maxPeople: 4
        },
        [
            { payment_method: "cash", order_status: "JOINED" },
            { payment_method: "bkash", order_status: "CANCELLED" }
        ]
    );

    assert.equal(totals.joinedCount, 1);
    assert.equal(totals.grandTotal, 112.5);
    assert.equal(totals.paymentTotals.bkash, 0);
    assert.equal(totals.paymentTotals.cash, 112.5);
});

test("money rounding is deterministic", () => {
    assert.equal(roundMoney(0.1 + 0.2), 0.3);
});
