import db from "../db.js";

export const OFFER_STATUSES = Object.freeze([
  "OPEN",
  "ENDED",
  "COMPLETED",
  "DISMISSED",
  "DISABLED",
  "SUCCESSFUL"
]);

export function normalizeOfferStatus(status) {
  const value = String(status || "").trim().toUpperCase();
  if (value === "COMPLETED") return "COMPLETED";
  if (value === "DISMISSED") return "DISMISSED";
  if (value === "CLOSED") return "ENDED";
  return OFFER_STATUSES.includes(value) ? value : "OPEN";
}

export function getAllowedPaymentMethods(offer) {
  const methods = [];
  if (Number(offer.payment_bkash_enabled) === 1) methods.push("bkash");
  if (Number(offer.payment_citybank_enabled) === 1) methods.push("city_bank");
  if (Number(offer.payment_cash_enabled) === 1) methods.push("cash");
  return methods;
}

export function validatePaymentConfiguration(paymentMethods) {
  if (!paymentMethods || typeof paymentMethods !== "object" || Array.isArray(paymentMethods)) {
    return { error: "Payment methods are required." };
  }

  const bkashEnabled = paymentMethods.bkash?.enabled === true;
  const cityBankEnabled = paymentMethods.cityBank?.enabled === true;
  const cashEnabled = paymentMethods.cash?.enabled === true;

  if (!bkashEnabled && !cityBankEnabled && !cashEnabled) {
    return { error: "At least one payment method is required." };
  }

  const bkashNumber = paymentMethods.bkash?.number?.trim() || "";
  if (bkashEnabled && !bkashNumber) {
    return { error: "bKash number is required." };
  }

  const accountName = paymentMethods.cityBank?.accountName?.trim() || "";
  const accountNumber = paymentMethods.cityBank?.accountNumber?.trim() || "";
  const phoneNumber = paymentMethods.cityBank?.phoneNumber?.trim() || "";

  if (
    cityBankEnabled &&
    !((accountName && accountNumber) || phoneNumber)
  ) {
    return {
      error:
        "For City Bank, provide Account Name + Account Number OR Phone Number."
    };
  }

  return {
    paymentMethods,
    bkashEnabled,
    cityBankEnabled,
    cashEnabled,
    bkashNumber,
    accountName,
    accountNumber,
    phoneNumber
  };
}

export function serializePaymentMethods(config) {
  return JSON.stringify([
    ...(config.bkashEnabled ? ["bkash"] : []),
    ...(config.cityBankEnabled ? ["city_bank"] : []),
    ...(config.cashEnabled ? ["cash"] : [])
  ]);
}

export function getOfferParticipants(offerId) {
  return db.prepare(`
    SELECT
      op.id,
      op.offer_id,
      op.user_id,
      op.joined_at,
      op.food_received,
      op.received_at,
      op.payment_method,
      op.amount,
      u.full_name,
      u.profile_picture
    FROM offer_participants op
    JOIN users u ON u.id = op.user_id
    WHERE op.offer_id = ?
    ORDER BY op.joined_at ASC
  `).all(offerId);
}

export function syncParticipantAmounts(offer, participants) {
  const costPerPerson =
    Number(offer.food_price) +
    (Number(offer.max_people) > 0
      ? Number(offer.delivery_charge) / Number(offer.max_people)
      : 0);

  const update = db.prepare(`
    UPDATE offer_participants
    SET amount = ?
    WHERE id = ?
  `);

  for (const participant of participants) {
    update.run(costPerPerson, participant.id);
  }

  return costPerPerson;
}

export function canTransitionOfferStatus(from, to) {
  const source = normalizeOfferStatus(from);
  const target = normalizeOfferStatus(to);

  if (source === target) return true;

  const transitions = {
    OPEN: new Set(["ENDED", "COMPLETED", "DISMISSED", "DISABLED"]),
    ENDED: new Set(["COMPLETED"]),
    COMPLETED: new Set(["SUCCESSFUL"]),
    DISMISSED: new Set([]),
    DISABLED: new Set(["OPEN", "DISMISSED"]),
    SUCCESSFUL: new Set([])
  };

  return transitions[source]?.has(target) === true;
}
