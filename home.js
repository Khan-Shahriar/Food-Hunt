/* ==========================================
   Food Hunt Home
========================================== */

const API = "/api";


/* ==========================================
   State
========================================== */

let currentUser = null;
let allOffers = [];
let currentManageOffer = null;
let countdownTimer = null;


/* ==========================================
   Elements
========================================== */

const myOffersContainer =
    document.querySelector("[data-my-offers]");

const joinedOffersContainer =
    document.querySelector("[data-joined-offers]");

const activeCountElement =
    document.querySelector("[data-active-count]");

const joinedCountElement =
    document.querySelector("[data-joined-count]");

const userNameElement =
    document.querySelector("[data-user-name]");

const profileInitialElement =
    document.querySelector("[data-profile-initial]");

const manageSection =
    document.querySelector("[data-manage-section]");

const manageFoodElement =
    document.querySelector("[data-manage-food]");

const manageRestaurantElement =
    document.querySelector("[data-manage-restaurant]");

const manageStatusElement =
    document.querySelector("[data-manage-status]");

const manageCountElement =
    document.querySelector("[data-manage-count]");

const manageTimeElement =
    document.querySelector("[data-manage-time]");

const manageEndElement =
    document.querySelector("[data-manage-end]");

const participantsList =
    document.querySelector("[data-participants-list]");

const successBox =
    document.querySelector("[data-success-box]");

const endOfferButton =
    document.querySelector("[data-end-offer]");

const closeManageButton =
    document.querySelector("[data-close-manage]");

const toastStack =
    document.querySelector("[data-toast-stack]");

const logoutButton =
    document.querySelector("[data-logout]");


/* ==========================================
   Helpers
========================================== */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function formatDateTime(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(
        value.includes("T")
            ? value
            : value.replace(" ", "T") + "Z"
    );

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });

}


function formatCountdown(endTime) {

    if (!endTime) {
        return "--";
    }

    const end = new Date(
        endTime.includes("T")
            ? endTime
            : endTime.replace(" ", "T") + "Z"
    );

    const difference = end.getTime() - Date.now();

    if (difference <= 0) {
        return "Ended";
    }

    const totalSeconds =
        Math.floor(difference / 1000);

    const hours =
        Math.floor(totalSeconds / 3600);

    const minutes =
        Math.floor((totalSeconds % 3600) / 60);

    const seconds =
        totalSeconds % 60;

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
    );

}


function getInitials(name) {

    if (!name) {
        return "U";
    }

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0])
        .join("")
        .toUpperCase();

}


function showToast(message) {

    if (!toastStack) {
        alert(message);
        return;
    }

    const toast =
        document.createElement("div");

    toast.className = "toast";

    toast.textContent = message;

    toastStack.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);

}


/* ==========================================
   Authentication
========================================== */

async function loadCurrentUser() {

    try {

        const response = await fetch(
            API + "/auth/me",
            {
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Authentication required.");
        }

        const data = await response.json();

        currentUser =
            data.user || data;

        updateUserUI();

    } catch (error) {

        console.error(
            "USER LOAD ERROR:",
            error
        );

        /*
         * Keep the existing application behavior:
         * send unauthenticated users to login.
         */
        window.location.href = "index.html";

    }

}


function updateUserUI() {

    if (!currentUser) {
        return;
    }

    const name =
        currentUser.fullName ||
        currentUser.full_name ||
        currentUser.name ||
        "User";

    if (userNameElement) {
        userNameElement.textContent = name;
    }

    if (profileInitialElement) {
        profileInitialElement.textContent =
            getInitials(name);
    }

}


/* ==========================================
   Load Offers
========================================== */

async function loadOffers() {

    try {

        const response = await fetch(
            API + "/offers",
            {
                credentials: "include"
            }
        );

        if (response.status === 401) {
            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            throw new Error(
                "Failed to load offers."
            );
        }

        allOffers = await response.json();

        renderOffers();

    } catch (error) {

        console.error(
            "OFFERS LOAD ERROR:",
            error
        );

        showToast(
            "Failed to load offers."
        );

    }

}


/* ==========================================
   Determine Offer Ownership
========================================== */

function isMyOffer(offer) {

    if (!currentUser || !offer) {
        return false;
    }

    return Number(offer.user_id) ===
        Number(currentUser.id);

}


/* ==========================================
   Render Offers
========================================== */

function renderOffers() {

    const myOffers =
        allOffers.filter(
            offer =>
                isMyOffer(offer) &&
                offer.status === "OPEN"
        );

    const joinedOffers =
        allOffers.filter(
            offer =>
                !isMyOffer(offer) &&
                Number(offer.joined) === 1
        );

    renderMyOffers(myOffers);

    renderJoinedOffers(joinedOffers);

    if (activeCountElement) {
        activeCountElement.textContent =
            `${myOffers.length} ${myOffers.length === 1
                ? "offer"
                : "offers"
            }`;
    }

    if (joinedCountElement) {
        joinedCountElement.textContent =
            `${joinedOffers.length} ${joinedOffers.length === 1
                ? "offer"
                : "offers"
            }`;
    }

}


/* ==========================================
   My Offers
========================================== */

function renderMyOffers(offers) {

    if (!myOffersContainer) {
        return;
    }

    if (!offers.length) {

        myOffersContainer.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    🍽️
                </div>

                <h3>
                    No active offers
                </h3>

                <p>
                    Create an offer and invite your
                    office colleagues to join.
                </p>

                <a
                    class="button button-primary"
                    href="create-offer.html">
                    Create Offer
                </a>

            </div>
        `;

        return;
    }

    myOffersContainer.innerHTML =
        offers.map(createMyOfferCard).join("");

}


/* ==========================================
   Joined Offers
========================================== */

function renderJoinedOffers(offers) {

    if (!joinedOffersContainer) {
        return;
    }

    if (!offers.length) {

        joinedOffersContainer.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    👥
                </div>

                <h3>
                    No joined offers
                </h3>

                <p>
                    Offers you join will appear here.
                </p>

            </div>
        `;

        return;
    }

    joinedOffersContainer.innerHTML =
        offers.map(createJoinedOfferCard).join("");

}


/* ==========================================
   My Offer Card
========================================== */

function createMyOfferCard(offer) {

    const participantCount =
        Number(offer.participant_count) || 0;

    const maxPeople =
        Number(offer.max_people) || 0;

    return `
        <article class="offer-card">

            <div class="offer-card-header">

                <div>

                    <h3>
                        ${escapeHTML(offer.food_name)}
                    </h3>

                    <p class="offer-restaurant">
                        ${escapeHTML(
        offer.restaurant_name
    )}
                    </p>

                </div>

                <span
                    class="home-status home-status-active">
                    Active
                </span>

            </div>


            <div class="offer-card-body">

                <div class="offer-stat-row">

                    <div class="offer-stat">

                        <span>
                            Participants
                        </span>

                        <strong>
                            ${participantCount} / ${maxPeople}
                        </strong>

                    </div>


                    <div class="offer-stat">

                        <span>
                            Time Left
                        </span>

                        <strong
                            data-countdown="${offer.id}">
                            ${formatCountdown(
        offer.end_time
    )}
                        </strong>

                    </div>

                </div>

            </div>


            <div class="offer-card-footer">

                <span class="offer-creator">
                    Created by You
                </span>

                <button
                    class="button button-primary button-small"
                    type="button"
                    data-manage-offer="${offer.id}">
                    Manage Offer
                </button>

            </div>

        </article>
    `;

}


/* ==========================================
   Joined Offer Card
========================================== */

function createJoinedOfferCard(offer) {

    const participantCount =
        Number(offer.participant_count) || 0;

    const maxPeople =
        Number(offer.max_people) || 0;

    return `
        <article class="offer-card">

            <div class="offer-card-header">

                <div>

                    <h3>
                        ${escapeHTML(offer.food_name)}
                    </h3>

                    <p class="offer-restaurant">
                        ${escapeHTML(
        offer.restaurant_name
    )}
                    </p>

                </div>

                <span
                    class="home-status home-status-joined">
                    Joined
                </span>

            </div>


            <div class="offer-card-body">

                <div class="offer-stat-row">

                    <div class="offer-stat">

                        <span>
                            Created By
                        </span>

                        <strong>
                            ${escapeHTML(
        offer.full_name ||
        "Unknown"
    )}
                        </strong>

                    </div>


                    <div class="offer-stat">

                        <span>
                            Participants
                        </span>

                        <strong>
                            ${participantCount} / ${maxPeople}
                        </strong>

                    </div>

                </div>


                <div class="offer-stat">

                    <span>
                        Time Left
                    </span>

                    <strong
                        data-countdown="${offer.id}">
                        ${formatCountdown(
        offer.end_time
    )}
                    </strong>

                </div>

            </div>


            <div class="offer-card-footer">

                <span class="offer-creator">
                    You joined this offer
                </span>

                <span
                    class="home-status home-status-joined">
                    ✓ Joined
                </span>

            </div>

        </article>
    `;

}


/* ==========================================
   Manage Offer
========================================== */

async function openManageOffer(offerId) {

    const offer =
        allOffers.find(
            item =>
                Number(item.id) ===
                Number(offerId)
        );

    if (!offer) {
        showToast("Offer not found.");
        return;
    }

    if (!isMyOffer(offer)) {
        showToast(
            "Only the creator can manage this offer."
        );
        return;
    }

    currentManageOffer = offer;

    manageSection.hidden = false;

    manageFoodElement.textContent =
        offer.food_name || "-";

    manageRestaurantElement.textContent =
        offer.restaurant_name || "-";

    manageEndElement.textContent =
        formatDateTime(offer.end_time);

    updateManageStatus();

    await loadParticipants(offer.id);

    manageSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* ==========================================
   Close Manage
========================================== */

function closeManageOffer() {

    currentManageOffer = null;

    if (manageSection) {
        manageSection.hidden = true;
    }

    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

}


/* ==========================================
   Manage Status
========================================== */

function updateManageStatus() {

    if (!currentManageOffer) {
        return;
    }

    const status =
        currentManageOffer.status;

    manageStatusElement.className =
        "status-pill";

    if (status === "SUCCESSFUL") {

        manageStatusElement.textContent =
            "Successful";

        manageStatusElement.classList.add(
            "home-status",
            "home-status-successful"
        );

        endOfferButton.disabled = true;

        return;
    }

    if (status === "ENDED") {

        manageStatusElement.textContent =
            "Ended";

        manageStatusElement.classList.add(
            "home-status",
            "home-status-ended"
        );

        endOfferButton.disabled = true;

        return;
    }

    manageStatusElement.textContent =
        "Active";

    manageStatusElement.classList.add(
        "home-status",
        "home-status-active"
    );

    endOfferButton.disabled = false;

}


/* ==========================================
   Participants
========================================== */

async function loadParticipants(offerId) {

    if (!participantsList) {
        return;
    }

    participantsList.innerHTML = `
        <div class="loading-state">
            Loading participants...
        </div>
    `;

    try {

        const response = await fetch(
            `${API}/offers/${offerId}/participants`,
            {
                credentials: "include"
            }
        );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Failed to load participants."
            );
        }

        renderParticipants(
            result.participants || []
        );

    } catch (error) {

        console.error(
            "PARTICIPANTS ERROR:",
            error
        );

        participantsList.innerHTML = `
            <div class="loading-state">
                ${escapeHTML(
            error.message ||
            "Failed to load participants."
        )}
            </div>
        `;

    }

}


/* ==========================================
   Render Participants
========================================== */

function renderParticipants(participants) {

    const total =
        participants.length;

    const received =
        participants.filter(
            participant =>
                Number(
                    participant.food_received
                ) === 1
        ).length;

    const maxPeople =
        Number(
            currentManageOffer?.max_people
        ) || total;

    manageCountElement.textContent =
        `${total} / ${maxPeople}`;

    /*
     * Everyone received food.
     */
    if (
        total > 0 &&
        received === total
    ) {

        successBox.hidden = false;

    } else {

        successBox.hidden = true;

    }


    if (!participants.length) {

        participantsList.innerHTML = `
            <div class="loading-state">
                No one has joined this offer yet.
            </div>
        `;

        return;
    }


    participantsList.innerHTML =
        participants.map(
            createParticipantRow
        ).join("");

}


/* ==========================================
   Participant Row
========================================== */

function createParticipantRow(participant) {

    const received =
        Number(
            participant.food_received
        ) === 1;

    const name =
        participant.full_name ||
        "Unknown";

    const initials =
        getInitials(name);

    const avatar =
        participant.profile_picture
            ? `
                <img
                    src="${escapeHTML(
                participant.profile_picture
            )}"
                    alt=""
                />
            `
            : initials;

    return `
        <div class="participant-row">

            <div class="participant-avatar">
                ${avatar}
            </div>


            <div class="participant-info">

                <span class="participant-name">
                    ${escapeHTML(name)}
                </span>

                <span class="participant-time">
                    Joined
                    ${formatDateTime(
        participant.joined_at
    )}
                </span>

            </div>


            <label class="received-control">

                <input
                    type="checkbox"
                    data-received-user="${participant.user_id}"
                    ${received ? "checked" : ""}
                />

                <span>
                    Food Received
                </span>

            </label>

        </div>
    `;

}


/* ==========================================
   Food Received
========================================== */

async function updateFoodReceived(
    userId,
    received
) {

    if (!currentManageOffer) {
        return;
    }

    try {

        const response = await fetch(
            `${API}/offers/${currentManageOffer.id}/participants/${userId}/received`,
            {
                method: "PATCH",

                credentials: "include",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    received
                })
            }
        );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Failed to update food status."
            );
        }

        showToast(
            received
                ? "Food marked as received."
                : "Food marked as not received."
        );

        if (result.successful) {

            currentManageOffer.status =
                "SUCCESSFUL";

            updateManageStatus();

        }

        await loadParticipants(
            currentManageOffer.id
        );

        await loadOffers();

    } catch (error) {

        console.error(
            "FOOD STATUS ERROR:",
            error
        );

        showToast(
            error.message ||
            "Failed to update food status."
        );

        await loadParticipants(
            currentManageOffer.id
        );

    }

}


/* ==========================================
   End Offer
========================================== */

async function endCurrentOffer() {

    if (!currentManageOffer) {
        return;
    }

    if (
        currentManageOffer.status !==
        "OPEN"
    ) {
        return;
    }

    const confirmed =
        confirm(
            "Are you sure you want to end this offer?\n\nPeople will no longer be able to join it."
        );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            `${API}/offers/${currentManageOffer.id}/end`,
            {
                method: "POST",
                credentials: "include"
            }
        );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Failed to end offer."
            );
        }

        currentManageOffer.status =
            "ENDED";

        updateManageStatus();

        showToast(
            "Offer ended successfully."
        );

        await loadOffers();

        await loadParticipants(
            currentManageOffer.id
        );

    } catch (error) {

        console.error(
            "END OFFER ERROR:",
            error
        );

        showToast(
            error.message ||
            "Failed to end offer."
        );

    }

}


/* ==========================================
   Countdown
========================================== */

function updateCountdowns() {

    document
        .querySelectorAll("[data-countdown]")
        .forEach(element => {

            const offerId =
                element.dataset.countdown;

            const offer =
                allOffers.find(
                    item =>
                        String(item.id) ===
                        String(offerId)
                );

            if (!offer) {
                return;
            }

            const time =
                formatCountdown(
                    offer.end_time
                );

            element.textContent = time;

        });


    if (currentManageOffer) {

        const time =
            formatCountdown(
                currentManageOffer.end_time
            );

        manageTimeElement.textContent =
            time;

        /*
         * If the timer reaches zero,
         * refresh the offer list so the
         * backend status can be respected.
         */
        if (time === "Ended") {

            manageTimeElement.textContent =
                "Ended";

        }

    }

}


/* ==========================================
   Logout
========================================== */

async function logout() {

    try {

        await fetch(
            API + "/auth/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }

    window.location.href =
        "index.html";

}


/* ==========================================
   Event Delegation
========================================== */

document.addEventListener(
    "click",
    event => {

        const manageButton =
            event.target.closest(
                "[data-manage-offer]"
            );

        if (manageButton) {

            openManageOffer(
                manageButton.dataset.manageOffer
            );

            return;
        }

    }
);


document.addEventListener(
    "change",
    event => {

        const checkbox =
            event.target.closest(
                "[data-received-user]"
            );

        if (!checkbox) {
            return;
        }

        updateFoodReceived(
            checkbox.dataset.receivedUser,
            checkbox.checked
        );

    }
);


/* ==========================================
   Event Listeners
========================================== */

if (closeManageButton) {

    closeManageButton.addEventListener(
        "click",
        closeManageOffer
    );

}


if (endOfferButton) {

    endOfferButton.addEventListener(
        "click",
        endCurrentOffer
    );

}


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        logout
    );

}


/* ==========================================
   Initialize
========================================== */

async function initHome() {

    await loadCurrentUser();

    if (!currentUser) {
        return;
    }

    await loadOffers();

    updateCountdowns();

    countdownTimer =
        setInterval(
            updateCountdowns,
            1000
        );

}


initHome();