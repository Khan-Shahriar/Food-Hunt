function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateOfferTotals(offer, participants = []) {
  const foodPrice = Number(offer.foodPrice ?? offer.food_price);
  const deliveryCharge = Number(offer.deliveryCharge ?? offer.delivery_charge);
  const maxParticipants = Number(offer.maxPeople ?? offer.max_people);

  const safeFoodPrice = Number.isFinite(foodPrice) && foodPrice >= 0 ? foodPrice : 0;
  const safeDeliveryCharge =
    Number.isFinite(deliveryCharge) && deliveryCharge >= 0
      ? deliveryCharge
      : 0;
  const safeMaxParticipants =
    Number.isInteger(maxParticipants) && maxParticipants > 0
      ? maxParticipants
      : 0;

  const joinedCount = participants.length;
  const deliveryShare =
    safeMaxParticipants > 0
      ? safeDeliveryCharge / safeMaxParticipants
      : 0;

  const costPerPerson = money(safeFoodPrice + deliveryShare);
  const totalAmount = money(costPerPerson * joinedCount);
  const remainingSlots = Math.max(safeMaxParticipants - joinedCount, 0);
  const progress =
    safeMaxParticipants > 0
      ? Math.min((joinedCount / safeMaxParticipants) * 100, 100)
      : 0;

  const paymentTotals = {
    bkash: 0,
    cityBank: 0,
    cash: 0
  };

  for (const participant of participants) {
    const amount = costPerPerson;
    if (participant.payment_method === "bkash") {
      paymentTotals.bkash = money(paymentTotals.bkash + amount);
    } else if (participant.payment_method === "city_bank") {
      paymentTotals.cityBank = money(paymentTotals.cityBank + amount);
    } else if (participant.payment_method === "cash") {
      paymentTotals.cash = money(paymentTotals.cash + amount);
    }
  }

  const grandTotal = money(
    paymentTotals.bkash +
    paymentTotals.cityBank +
    paymentTotals.cash
  );

  return {
    joinedCount,
    deliveryShare: money(deliveryShare),
    costPerPerson,
    totalAmount,
    remainingSlots,
    progress,
    paymentTotals,
    grandTotal
  };
}
