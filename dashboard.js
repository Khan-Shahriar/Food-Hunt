const newsList = document.querySelector("[data-news-list]");
const participantsElement = document.getElementById("summaryPeople");
const totalCostElement = document.getElementById("summaryTotalCost");
const perHeadElement = document.getElementById("summaryPerHead");
const deliveryElement = document.getElementById("summaryDelivery");


const joinButton = document.querySelector(".join-btn");


let countdownInterval = null;
let selectedOffer = null;

function getRestaurantLogo(name) {

    const restaurant = name.toLowerCase().trim();

    if (restaurant === "kfc")
        return "assets/restaurants/kfc.png";

    if (restaurant === "pizza hut")
        return "assets/restaurants/pizza-hut.png";

    if (restaurant === "bfc")
        return "assets/restaurants/bfc.png";

    return "assets/restaurants/default.png";

}

async function renderNews() {

    if (!newsList) return;

    try {

        const offers = await api("/offers");

        newsList.innerHTML = "";

        offers.forEach((offer) => {

            console.log(offer);

            newsList.innerHTML += `
      <li class="offer-card"
      data-offer-id="${offer.id}">
    
            <img
                class="restaurant-logo"
                src="${getRestaurantLogo(offer.restaurant_name)}"
                alt="${offer.restaurant_name}"
            >

            <div class="offer-content">

                <div class="offer-top">

                    <div class="offer-left">

                        <strong>
                            ${offer.restaurant_name}
                        </strong>

                        <small>
                            Created by ${offer.full_name}
                        </small>

                    </div>

                    <div class="offer-right">

                        <span class="offer-badge">
                            New
                        </span>

                        <span
                        class="offer-time"
                        data-end="${offer.end_time}">
                        --
                        </span>

                    </div>

                </div>

            </div>

        </li>
        `;

        });

        document.querySelectorAll(".offer-card").forEach((card) => {

            card.addEventListener("click", () => {

                const id = Number(card.dataset.offerId);

                const offer = offers.find(o => o.id === id);

                if (!offer) return;

                showOfferSummary(offer);

            });

        });

        document.querySelectorAll(".news-join-btn").forEach((button) => {

            button.addEventListener("click", async (e) => {

                e.stopPropagation();

                const offer = offers.find(
                    o => o.id === Number(button.dataset.offer)
                );

                if (!offer) return;

                selectedOffer = offer;

                await joinOffer();

            });

        });

        console.log("renderNews finished");
        updateOfferTimes();

    } catch (err) {

        console.error(err);

    }

}

function updateOfferTimes() {

    document.querySelectorAll(".offer-time").forEach((item) => {

        const endString = item.dataset.end;

        if (!endString) {
            item.textContent = "--";
            return;
        }

        const end = new Date(endString);
        const now = new Date();

        const diff = end.getTime() - now.getTime();

        if (isNaN(diff)) {
            item.textContent = "--";
            return;
        }

        if (diff <= 0) {
            item.textContent = "Expired";
            return;
        }

        const totalSeconds = Math.floor(diff / 1000);

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            item.textContent = `${hours}h ${minutes}m`;
        } else {
            item.textContent = `${minutes}m ${seconds}s`;
        }

    });

}

setInterval(updateOfferTimes, 1000);

/* ==========================================
   Show Offer Summary
========================================== */

function showOfferSummary(offer) {

    selectedOffer = offer;

    // ==========================
    // Join Button
    // ==========================

    joinButton.classList.remove("full");

    if (offer.participant_count >= offer.max_people) {

        joinButton.disabled = true;
        joinButton.textContent = "Order Full";
        joinButton.classList.add("full");

    } else if (Number(offer.joined) === 1) {

        joinButton.disabled = true;
        joinButton.textContent = "✓ Joined";
        joinButton.classList.add("joined");

    } else {

        joinButton.disabled = false;
        joinButton.textContent = "Join Order";

    }


    // ==========================
    // Group Order Summary
    // ==========================

    document.getElementById("summaryRestaurant").textContent =
        offer.restaurant_name || "-";

    document.getElementById("summaryFoodName").textContent =
        offer.food_name || "-";

    document.getElementById("summaryDescription").textContent =
        offer.food_description || "-";

    document.getElementById("summaryPeople").textContent =
        `${offer.participant_count || 0} / ${offer.max_people || 0}`;

    document.getElementById("summaryCreatedBy").textContent =
        offer.full_name || "-";


    // ==========================
    // Order Status + Time Left
    // ==========================

    startCountdown(offer.end_time || offer.endTime);


    // ==========================
    // Cost Cards
    // ==========================

    const foodPrice = Number(offer.food_price) || 0;

    const deliveryCharge =
        Number(offer.delivery_charge) || 0;

    const maxPeople =
        Number(offer.max_people) || 1;

    const deliveryPerHead =
        deliveryCharge / maxPeople;

    const totalCost =
        foodPrice + deliveryPerHead;


    document.getElementById("summaryPerHead").textContent =
        "৳" + foodPrice.toFixed(2);

    document.getElementById("summaryDelivery").textContent =
        "৳" + deliveryPerHead.toFixed(2);

    document.getElementById("summaryTotalCost").textContent =
        "৳" + totalCost.toFixed(2);
}

/*------------------------------------*/

async function joinOffer() {

    if (!selectedOffer) {
        return;
    }


    try {

        const data = await api(`/offers/${selectedOffer.id}/join`, {

            method: "POST"

        });

        showToast(data.message, "success");

    } catch (err) {

        showToast(err.message, "error");

    }
}



/* ==========================================
   Group Order Countdown
========================================== */

function startCountdown(endTime) {

    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    const statusElement =
        document.getElementById("summaryStatus");

    const timeLeftElement =
        document.getElementById("summaryTimeLeft");


    function update() {

        if (!endTime) {

            statusElement.textContent = "Waiting...";
            timeLeftElement.textContent = "--";

            return;
        }


        const now = new Date();

        let end;


        // ==========================================
        // Full date/time from API
        // Example:
        // 2026-08-10T04:30:00
        // ==========================================

        if (
            typeof endTime === "string" &&
            (endTime.includes("T") || endTime.includes("-"))
        ) {

            end = new Date(endTime);

        }


        // ==========================================
        // Time only
        // Example:
        // 04:30
        // ==========================================

        else {

            const parts = String(endTime).split(":");

            const hour = Number(parts[0]);
            const minute = Number(parts[1]);

            if (isNaN(hour) || isNaN(minute)) {

                statusElement.textContent = "Waiting...";
                timeLeftElement.textContent = "--";

                return;
            }

            end = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                hour,
                minute,
                0
            );
        }


        // ==========================================
        // Invalid date
        // ==========================================

        if (isNaN(end.getTime())) {

            statusElement.textContent = "Waiting...";
            timeLeftElement.textContent = "--";

            return;
        }


        const diff =
            end.getTime() - now.getTime();


        // ==========================================
        // Expired
        // ==========================================

        if (diff <= 0) {

            statusElement.textContent = "Closed";
            timeLeftElement.textContent = "Expired";

            clearInterval(countdownInterval);

            return;
        }


        // ==========================================
        // Active
        // ==========================================

        statusElement.textContent = "Waiting...";


        const totalSeconds =
            Math.floor(diff / 1000);

        const hours =
            Math.floor(totalSeconds / 3600);

        const minutes =
            Math.floor(
                (totalSeconds % 3600) / 60
            );

        const seconds =
            totalSeconds % 60;


        timeLeftElement.textContent =
            `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }


    update();

    countdownInterval =
        setInterval(update, 1000);
}

setInterval(updateNewsCountdowns, 1000);

function updateNewsCountdowns() {

    document.querySelectorAll(".countdown-badge").forEach((badge) => {

        const endTime = badge.dataset.end;

        if (!endTime) return;

        const now = new Date();

        const [hour, minute] = endTime.split(":");

        const end = new Date();

        end.setHours(Number(hour));
        end.setMinutes(Number(minute));
        end.setSeconds(0);

        const diff = end - now;

        if (diff <= 0) {

            badge.textContent = "🔴 Closed";
            return;

        }

        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        badge.textContent =
            `⏳ ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    });

}

if (joinButton) {

    joinButton.addEventListener("click", joinOffer);

}

const profileAvatarInput = document.querySelector("[data-profile-avatar-input]");
const profileAvatar = document.querySelector("[data-profile-avatar]");

if (profileAvatarInput && profileAvatar) {
  profileAvatarInput.addEventListener("change", () => {
    const file = profileAvatarInput.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      profileAvatar.innerHTML = `
        <img src="${reader.result}" alt="Profile photo">
      `;
    };

    reader.readAsDataURL(file);
  });
}