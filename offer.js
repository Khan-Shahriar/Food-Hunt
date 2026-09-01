/* ==========================================
   Configuration
========================================== */

const API = "/api";
const urlParams = new URLSearchParams(window.location.search);
const editOfferId = urlParams.get("edit");
const isEditMode = Boolean(editOfferId);


/* ==========================================
   Form Elements
========================================== */

const form = document.getElementById("offerForm");

const restaurantInput = document.getElementById("restaurantName");
const foodInput = document.getElementById("foodName");
const descriptionInput = document.getElementById("foodDescription");

const quantityInput = document.getElementById("quantity");
const priceInput = document.getElementById("foodPrice");
const deliveryInput = document.getElementById("deliveryCharge");
const peopleInput = document.getElementById("maxPeople");

const startInput = document.getElementById("startTime");
const endInput = document.getElementById("endTime");
const bkashCheckbox = document.getElementById("payment-bkash");
const bkashFields = document.getElementById("bkashFields");
const bkashNumberInput = document.getElementById("bkashNumber");

const cityBankCheckbox = document.getElementById("payment-citybank");

const cityBankFields = document.getElementById("cityBankFields");

const cityBankAccountName =
    document.getElementById("cityBankAccountName");

const cityBankAccountNumber =
    document.getElementById("cityBankAccountNumber");

const cityBankPhone =
    document.getElementById("cityBankPhone");

const cashCheckbox =
    document.getElementById("payment-cash");

const cashFields =
    document.getElementById("cashFields");

const cashCreatorName =
    document.getElementById("cashCreatorName");

/* ==========================================
   Preview Elements
========================================== */

const previewRestaurant = document.getElementById("previewRestaurant");
const previewFood = document.getElementById("previewFood");
const previewQty = document.getElementById("previewQty");
const previewPeople = document.getElementById("previewPeople");
const previewPrice = document.getElementById("previewPrice");
const previewDelivery = document.getElementById("previewDelivery");
const previewTotal = document.getElementById("previewTotal");


/* ==========================================
   Live Preview
========================================== */

function updatePreview() {

    const restaurant = restaurantInput.value.trim();
    const food = foodInput.value.trim();

    const quantity = Number(quantityInput.value) || 0;
    const people = Number(peopleInput.value) || 0;

    const foodPrice = Number(priceInput.value) || 0;
    const delivery = Number(deliveryInput.value) || 0;

    previewRestaurant.textContent =
        restaurant || "Select a restaurant";

    previewFood.textContent =
        food || "Enter food name";

    previewQty.textContent = quantity;

    previewPeople.textContent = people;

    previewPrice.textContent =
        "৳" + foodPrice.toFixed(2);

    previewDelivery.textContent =
        "৳" + delivery.toFixed(2);

    if (people > 0) {

        const deliveryPerPerson =
            delivery / people;

        const totalPerPerson =
            foodPrice + deliveryPerPerson;

        previewTotal.textContent =
            "৳" + totalPerPerson.toFixed(2);

    } else {

        previewTotal.textContent =
            "৳" + foodPrice.toFixed(2);

    }

}

async function loadOfferForEdit() {
    if (!isEditMode) {
        return;
    }

    try {
        const res = await fetch(
            API + "/offers/" + encodeURIComponent(editOfferId),
            {
                method: "GET",
                credentials: "include"
            }
        );

        const result = await res.json();

        if (!res.ok || !result.success || !result.offer) {
            alert(result.message || "Failed to load offer.");
            return;
        }

        const offer = result.offer;

        restaurantInput.value = offer.restaurant_name || "";
        foodInput.value = offer.food_name || "";
        descriptionInput.value = offer.food_description || "";

        quantityInput.value = offer.quantity ?? "";
        priceInput.value = offer.food_price ?? "";
        deliveryInput.value = offer.delivery_charge ?? "";
        peopleInput.value = offer.max_people ?? "";

        startInput.value = offer.start_time || "";
        endInput.value = offer.end_time || "";

        // bKash
        bkashCheckbox.checked =
            Number(offer.payment_bkash_enabled) === 1;

        bkashNumberInput.value =
            offer.bkash_number || "";

        // City Bank
        cityBankCheckbox.checked =
            Number(offer.payment_citybank_enabled) === 1;

        cityBankAccountName.value =
            offer.citybank_account_name || "";

        cityBankAccountNumber.value =
            offer.citybank_account_number || "";

        cityBankPhone.value =
            offer.citybank_phone || "";

        // Cash
        cashCheckbox.checked =
            Number(offer.payment_cash_enabled) === 1;

        // Update payment field visibility
        toggleBkashFields();
        toggleCityBankFields();
        toggleCashFields();

        // Update preview
        updatePreview();

        console.log("Offer loaded for editing:", offer);

    } catch (err) {

        console.error("Failed to load offer for editing:", err);

        alert("Failed to load offer.");

    }
}

[
    restaurantInput,
    foodInput,
    quantityInput,
    priceInput,
    deliveryInput,
    peopleInput
].forEach(input => {

    input.addEventListener("input", updatePreview);

});

function setDefaultDateTimes() {

    const now = new Date();

    // Round to the next 5 minutes
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5);
    now.setSeconds(0);
    now.setMilliseconds(0);

    const end = new Date(now);
    end.setMinutes(end.getMinutes() + 45); // Default offer duration

    startInput.value = now.toISOString().slice(0, 16);
    endInput.value = end.toISOString().slice(0, 16);

}

if (!isEditMode) {
    setDefaultDateTimes();
}

updatePreview();
loadOfferForEdit();


/* ==========================================
   Payment Methods
========================================== */

function toggleBkashFields() {

    if (bkashCheckbox.checked) {

        bkashFields.hidden = false;
        bkashNumberInput.disabled = false;
        bkashNumberInput.required = true;

    } else {

        bkashFields.hidden = true;
        bkashNumberInput.disabled = true;
        bkashNumberInput.required = false;
        bkashNumberInput.value = "";

    }

}

function toggleCityBankFields() {

    if (cityBankCheckbox.checked) {

        cityBankFields.hidden = false;

        cityBankAccountName.disabled = false;
        cityBankAccountNumber.disabled = false;
        cityBankPhone.disabled = false;

    } else {

        cityBankFields.hidden = true;

        cityBankAccountName.disabled = true;
        cityBankAccountNumber.disabled = true;
        cityBankPhone.disabled = true;

        cityBankAccountName.required = false;
        cityBankAccountNumber.required = false;
        cityBankPhone.required = false;

        cityBankAccountName.value = "";
        cityBankAccountNumber.value = "";
        cityBankPhone.value = "";

    }

}

function toggleCashFields() {

    if (cashCheckbox.checked) {

        cashFields.hidden = false;

    } else {

        cashFields.hidden = true;

    }

}

cashCheckbox.addEventListener(
    "change",
    toggleCashFields
);

toggleCashFields();

async function loadCashCreatorName() {

    try {

        const res = await fetch(API + "/auth/me", {
            method: "GET",
            credentials: "include"
        });

        const result = await res.json();

        if (!res.ok || !result.user) {

            cashCreatorName.textContent =
                "Unable to load creator";

            return;
        }

        cashCreatorName.textContent =
            result.user.fullName;

    } catch (err) {

        console.error("Failed to load creator:", err);

        cashCreatorName.textContent =
            "Unable to load creator";

    }

}

loadCashCreatorName();

cityBankCheckbox.addEventListener(
    "change",
    toggleCityBankFields
);

toggleCityBankFields();

function validateCityBank() {

    if (!cityBankCheckbox.checked) {
        return true;
    }

    const hasAccountDetails =
        cityBankAccountName.value.trim() !== "" &&
        cityBankAccountNumber.value.trim() !== "";

    const hasPhone =
        cityBankPhone.value.trim() !== "";

    if (!hasAccountDetails && !hasPhone) {

        alert(
            "For City Bank, provide Account Name + Account Number OR Phone Number."
        );

        return false;
    }

    return true;
}

function validatePaymentMethods() {

    const hasPaymentMethod =
        bkashCheckbox.checked ||
        cityBankCheckbox.checked ||
        cashCheckbox.checked;

    if (!hasPaymentMethod) {

        alert("Please select at least one payment method.");

        return false;
    }

    return true;
}

bkashCheckbox.addEventListener("change", toggleBkashFields);

toggleBkashFields();


/* ==========================================
   Create Offer
========================================== */

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validatePaymentMethods()) return;
    if (!validateCityBank()) return;

    const data = {
        restaurantName: restaurantInput.value.trim(),
        foodName: foodInput.value.trim(),
        foodDescription: descriptionInput.value.trim(),

        quantity: Number(quantityInput.value),
        foodPrice: Number(priceInput.value),
        deliveryCharge: Number(deliveryInput.value),

        startTime: startInput.value,
        endTime: endInput.value,

        maxPeople: Number(peopleInput.value),

        paymentMethods: {
            bkash: {
                enabled: bkashCheckbox.checked,
                number: bkashCheckbox.checked
                    ? bkashNumberInput.value.trim()
                    : null
            },

            cityBank: {
                enabled: cityBankCheckbox.checked,
                accountName: cityBankCheckbox.checked
                    ? cityBankAccountName.value.trim()
                    : null,
                accountNumber: cityBankCheckbox.checked
                    ? cityBankAccountNumber.value.trim()
                    : null,
                phoneNumber: cityBankCheckbox.checked
                    ? cityBankPhone.value.trim()
                    : null
            },

            cash: {
                enabled: cashCheckbox.checked
            }
        }
    };

    try {
        const url = isEditMode
            ? API + "/offers/" + encodeURIComponent(editOfferId)
            : API + "/offers";

        const method = isEditMode
            ? "PATCH"
            : "POST";

        const res = await fetch(url, {
            method,
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        alert(result.message);

        if (res.ok) {

            if (isEditMode) {

                window.location.href = "index.html";

            } else {

                form.reset();

                toggleBkashFields();
                toggleCityBankFields();
                toggleCashFields();

                updatePreview();
            }
        }

    } catch (err) {

        console.error("Offer save error:", err);

        alert(
            isEditMode
                ? "Failed to update offer."
                : "Failed to create offer."
        );
    }
});


