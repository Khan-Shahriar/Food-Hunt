/* ==========================================
   Configuration
========================================== */

const API = "http://localhost:8080/api";


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

        const totalPerPerson =
            (foodPrice + delivery) / people;

        previewTotal.textContent =
            "৳" + totalPerPerson.toFixed(2);

    } else {

        previewTotal.textContent = "৳0.00";

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

updatePreview();


/* ==========================================
   Create Offer
========================================== */

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const data = {

        restaurantName: restaurantInput.value,

        foodName: foodInput.value,

        foodDescription: descriptionInput.value,

        quantity: Number(quantityInput.value),

        foodPrice: Number(priceInput.value),

        deliveryCharge: Number(deliveryInput.value),

        startTime: startInput.value,

        endTime: endInput.value,

        maxPeople: Number(peopleInput.value)

    };

    try {

        const res = await fetch(API + "/offers", {

            method: "POST",

            credentials: "include",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(data)

        });

        const result = await res.json();

        alert(result.message);

        if (res.ok) {

            form.reset();

            updatePreview();

        }

    } catch (err) {

        console.error(err);

        alert("Failed to create offer.");

    }

});