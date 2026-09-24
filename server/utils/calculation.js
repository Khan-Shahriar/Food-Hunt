const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function calculateOfferTotals(offer, participants = []) {
    const foodPrice = Math.max(0, Number(offer.foodPrice) || 0);
    const deliveryCharge = Math.max(0, Number(offer.deliveryCharge) || 0);
    const maxParticipants = Math.max(0, Number(offer.maxPeople) || 0);

    const activeParticipants = participants.filter(
        (participant) =>
            String(participant.order_status || "JOINED").toUpperCase() !== "CANCELLED"
    );

    const joinedCount = activeParticipants.length;

    const foodSubtotal = roundMoney(foodPrice * joinedCount);
    const deliveryAllocated = roundMoney(
        maxParticipants > 0
            ? deliveryCharge * (joinedCount / maxParticipants)
            : 0
    );

    const deliveryShare = roundMoney(
        maxParticipants > 0 ? deliveryCharge / maxParticipants : 0
    );

    const costPerPerson = roundMoney(foodPrice + deliveryShare);
    const totalAmount = roundMoney(costPerPerson * joinedCount);

    const remainingSlots = Math.max(maxParticipants - joinedCount, 0);

    const progress =
        maxParticipants > 0
            ? Math.min((joinedCount / maxParticipants) * 100, 100)
            : 0;

    const paymentTotals = {
        bkash: 0,
        cityBank: 0,
        cash: 0
    };

    activeParticipants.forEach((participant) => {
        const paymentMethod = participant.payment_method;

        if (paymentMethod === "bkash") {
            paymentTotals.bkash = roundMoney(
                paymentTotals.bkash + costPerPerson
            );
        } else if (paymentMethod === "city_bank") {
            paymentTotals.cityBank = roundMoney(
                paymentTotals.cityBank + costPerPerson
            );
        } else if (paymentMethod === "cash") {
            paymentTotals.cash = roundMoney(
                paymentTotals.cash + costPerPerson
            );
        }
    });

    const grandTotal = roundMoney(
        paymentTotals.bkash +
        paymentTotals.cityBank +
        paymentTotals.cash
    );

    return {
        joinedCount,
        foodSubtotal,
        deliveryAllocated,
        deliveryShare,
        costPerPerson,
        totalAmount,
        remainingSlots,
        progress,
        paymentTotals,
        grandTotal
    };
}

export { roundMoney };
