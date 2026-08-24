export function calculateOfferTotals(offer, participants = []) {
    const foodPrice = Number(offer.foodPrice) || 0;
    const deliveryCharge = Number(offer.deliveryCharge) || 0;
    const maxParticipants = Number(offer.maxPeople) || 0;

    const joinedCount = participants.length;

    const deliveryShare =
        maxParticipants > 0
            ? deliveryCharge / maxParticipants
            : 0;

    const costPerPerson =
        foodPrice + deliveryShare;

    const totalAmount =
        costPerPerson * joinedCount;

    const remainingSlots =
        Math.max(maxParticipants - joinedCount, 0);

    const progress =
        maxParticipants > 0
            ? Math.min(
                (joinedCount / maxParticipants) * 100,
                100
            )
            : 0;

    const paymentTotals = {
        bkash: 0,
        cityBank: 0,
        cash: 0
    };

    participants.forEach((participant) => {
        const paymentMethod = participant.payment_method;

        if (paymentMethod === "bkash") {
            paymentTotals.bkash += costPerPerson;
        } else if (paymentMethod === "city_bank") {
            paymentTotals.cityBank += costPerPerson;
        } else if (paymentMethod === "cash") {
            paymentTotals.cash += costPerPerson;
        }
    });

    const grandTotal =
        paymentTotals.bkash +
        paymentTotals.cityBank +
        paymentTotals.cash;

    return {
        joinedCount,
        deliveryShare,
        costPerPerson,
        totalAmount,
        remainingSlots,
        progress,
        paymentTotals,
        grandTotal
    };
}