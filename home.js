/* =========================================================
   FOOD HUNT — HOME PAGE
   Scoped to prevent conflicts with script.js
========================================================= */

(() => {
    "use strict";

    const API = "/api";

    /* =====================================================
       STATE
    ===================================================== */

    let currentUser = null;
    let allOffers = [];
    let currentManageOffer = null;
    let countdownTimer = null;


    /* =====================================================
       DOM ELEMENTS
    ===================================================== */

    const myOffersContainer =
        document.querySelector("[data-my-offers]");

    const joinedOffersContainer =
        document.querySelector("[data-joined-offers]");

    const activeCountElement =
        document.querySelector("[data-active-count]");

    const joinedCountElement =
        document.querySelector("[data-joined-count]");

    const userNameElementHome =
        document.querySelector("[data-user-name]");

    const profileInitialElementHome =
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

    const logoutButtonHome =
        document.querySelector("[data-logout]");


    /* =====================================================
       HELPERS
    ===================================================== */

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


    function getInitials(name) {

        if (!name) {
            return "U";
        }

        return String(name)
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(word => word.charAt(0))
            .join("")
            .toUpperCase();
    }


    function parseDate(value) {

        if (!value) {
            return null;
        }

        let dateString = String(value);

        /*
         * SQLite often returns:
         *
         * 2026-08-25 06:40:00
         *
         * Convert it to ISO-style format.
         */

        if (
            !dateString.includes("T") &&
            !dateString.endsWith("Z")
        ) {
            dateString =
                dateString.replace(" ", "T") + "Z";
        }

        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date;
    }


    function formatDateTime(value) {

        const date = parseDate(value);

        if (!date) {
            return value || "-";
        }

        return date.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }


    function formatCountdown(value) {

        const endDate = parseDate(value);

        if (!endDate) {
            return "--";
        }

        const difference =
            endDate.getTime() - Date.now();

        if (difference <= 0) {
            return "Ended";
        }

        const totalSeconds =
            Math.floor(difference / 1000);

        const hours =
            Math.floor(totalSeconds / 3600);

        const minutes =
            Math.floor(
                (totalSeconds % 3600) / 60
            );

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


    function showToast(message) {

        if (!toastStack) {
            console.log(message);
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


    /* =====================================================
       AUTHENTICATION
    ===================================================== */

    async function loadCurrentUser() {

        try {

            const response =
                await fetch(
                    `${API}/auth/me`,
                    {
                        credentials: "include"
                    }
                );

            if (!response.ok) {

                if (response.status === 401) {
                    window.location.href = "index.html";
                    return false;
                }

                throw new Error(
                    "Failed to load current user."
                );
            }

            const data =
                await response.json();

            currentUser =
                data.user || data;

            updateUserUI();

            return true;

        } catch (error) {

            console.error(
                "HOME USER ERROR:",
                error
            );

            window.location.href =
                "index.html";

            return false;
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

        if (userNameElementHome) {
            userNameElementHome.textContent =
                name;
        }

        if (profileInitialElementHome) {
            profileInitialElementHome.textContent =
                getInitials(name);
        }
    }


    /* =====================================================
       OFFERS
    ===================================================== */

    async function loadOffers() {

        try {

            const response =
                await fetch(
                    `${API}/offers`,
                    {
                        credentials: "include"
                    }
                );

            if (response.status === 401) {

                window.location.href =
                    "index.html";

                return;
            }

            if (!response.ok) {

                throw new Error(
                    "Failed to load offers."
                );
            }

            const data =
                await response.json();

            /*
             * Important:
             *
             * Do NOT redeclare allOffers here.
             * We must update the state variable.
             */

            if (Array.isArray(data)) {
                allOffers = data;
            } else if (Array.isArray(data.offers)) {
                allOffers = data.offers;
            } else {
                allOffers = [];
            }

            renderOffers();

            return allOffers;

        } catch (error) {

            console.error(
                "HOME OFFERS ERROR:",
                error
            );

            showToast(
                "Failed to load offers."
            );

            return [];
        }
    }


    /* =====================================================
       OFFER OWNERSHIP
    ===================================================== */

    function isMyOffer(offer) {

        if (!currentUser || !offer) {
            return false;
        }

        return (
            Number(offer.user_id) ===
            Number(currentUser.id)
        );
    }


    /* =====================================================
   RENDER OFFERS
    ===================================================== */

    /* =====================================================
   RENDER OFFERS
===================================================== */

    function renderOffers() {

        const myOffers = allOffers.filter(
            offer =>
                isMyOffer(offer) &&
                isActiveOffer(offer)
        );

        const joinedOffers = allOffers.filter(
            offer =>
                !isMyOffer(offer) &&
                Number(offer.joined) === 1
        );

        renderMyOffers(myOffers);

        renderJoinedOffers(joinedOffers);

        myOffers.forEach(offer => {
            loadHomeOfferDetails(offer.id);
        });

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


    /* =====================================================
       LOAD HOME OFFER DETAILS
    ===================================================== */

    async function loadHomeOfferDetails(offerId) {

        try {

            const response = await fetch(
                `${API}/offers/${offerId}/participants`,
                {
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                    "Failed to load offer details."
                );
            }

            renderHomeOfferDetails(
                offerId,
                result
            );

        } catch (error) {

            console.error(
                `HOME OFFER ${offerId} DETAILS ERROR:`,
                error
            );

            const participantsContainer =
                document.querySelector(
                    `[data-home-participants="${offerId}"]`
                );

            if (participantsContainer) {

                participantsContainer.innerHTML = `
                <div class="home-participants-loading">
                    Failed to load participants.
                </div>
            `;
            }
        }
    }


    /* =====================================================
       RENDER HOME OFFER DETAILS
    ===================================================== */

    function renderHomeOfferDetails(
        offerId,
        result
    ) {

        /*
         * Safely read API response.
         */
        const participants =
            Array.isArray(result?.participants)
                ? result.participants
                : [];

        /* =================================================
            PAYMENT METHOD COUNTS
        ================================================= */

        const bkashCount =
            participants.filter(participant => {

                const method =
                    String(
                        participant.payment_method ||
                        participant.paymentMethod ||
                        ""
                    ).toLowerCase();

                return method === "bkash";
            }).length;


        const cityBankCount =
            participants.filter(participant => {

                const method =
                    String(
                        participant.payment_method ||
                        participant.paymentMethod ||
                        ""
                    ).toLowerCase();

                return (
                    method === "city_bank" ||
                    method === "citybank"
                );
            }).length;


        const cashCount =
            participants.filter(participant => {

                const method =
                    String(
                        participant.payment_method ||
                        participant.paymentMethod ||
                        ""
                    ).toLowerCase();

                return method === "cash";
            }).length;


        const totals =
            result?.totals || {};


        /*
         * =================================================
         * PARTICIPANTS
         * =================================================
         */

        const participantsContainer =
            document.querySelector(
                `[data-home-participants="${offerId}"]`
            );


        if (participantsContainer) {

            /*
             * No participants.
             */
            if (!participants.length) {

                participantsContainer.innerHTML = `
                <div class="home-participants-loading">
                    No one has joined this offer yet.
                </div>
            `;

            }

            /*
             * Participants exist.
             */
            else {

                participantsContainer.innerHTML =
                    participants
                        .map(
                            participant =>
                                createHomeParticipantRow(
                                    participant
                                )
                        )
                        .join("");

            }

        }

        renderHomePaymentBreakdown(
            offerId,
            participants
        );


        /*
         * =================================================
         * PAYMENT TOTALS
         * =================================================
         */

        const paymentTotals =
            totals?.paymentTotals || {};


        const bkashTotal =
            Number(paymentTotals.bkash) || 0;


        const cityBankTotal =
            Number(paymentTotals.cityBank) || 0;


        const cashTotal =
            Number(paymentTotals.cash) || 0;


        const grandTotal =
            Number(totals.grandTotal) || 0;


        /* =================================================
   PAYMENT TOTAL CONSISTENCY CHECK
================================================= */

        const calculatedPaymentTotal =
            bkashTotal +
            cityBankTotal +
            cashTotal;


        if (
            Math.abs(
                calculatedPaymentTotal -
                grandTotal
            ) > 0.01
        ) {

            console.warn(
                "HOME PAYMENT TOTAL MISMATCH:",
                {
                    offerId,
                    bkashTotal,
                    cityBankTotal,
                    cashTotal,
                    calculatedPaymentTotal,
                    grandTotal
                }
            );

        }


        /* =================================================
   PAYMENT SUMMARY
================================================= */

        updateHomePaymentSummary(
            offerId,
            "bkash",
            bkashTotal
        );


        updateHomePaymentSummary(
            offerId,
            "city_bank",
            cityBankTotal
        );


        updateHomePaymentSummary(
            offerId,
            "cash",
            cashTotal
        );


        updateHomePaymentSummary(
            offerId,
            "total",
            grandTotal
        );

        /* =================================================
   PAYMENT BREAKDOWN TOTALS
================================================= */

        updateHomePaymentBreakdown(
            offerId,
            "bkash",
            bkashTotal
        );


        updateHomePaymentBreakdown(
            offerId,
            "city_bank",
            cityBankTotal
        );


        updateHomePaymentBreakdown(
            offerId,
            "cash",
            cashTotal
        );

        /* =================================================
        UPDATE PAYMENT COUNTS
        ================================================= */

        updateHomePaymentCount(
            offerId,
            "bkash",
            bkashCount
        );

        updateHomePaymentCount(
            offerId,
            "city_bank",
            cityBankCount
        );

        updateHomePaymentCount(
            offerId,
            "cash",
            cashCount
        );

    }




    /* =====================================================
       CREATE PARTICIPANT ROW
    ===================================================== */

    function createHomeParticipantRow(participant) {

        if (!participant) {
            return "";
        }

        const name =
            participant.full_name ||
            participant.fullName ||
            participant.name ||
            "Unknown";

        const paymentMethod =
            participant.payment_method ||
            participant.paymentMethod ||
            "-";

        let paymentLabel =
            String(paymentMethod)
                .trim()
                .toLowerCase();

        if (paymentLabel === "bkash") {

            paymentLabel = "bKash";

        } else if (
            paymentLabel === "city_bank" ||
            paymentLabel === "citybank"
        ) {

            paymentLabel = "City Bank";

        } else if (paymentLabel === "cash") {

            paymentLabel = "Cash";

        } else {

            paymentLabel = "Unknown";

        }

        return `
        <div class="home-participant-row">

            <span class="home-participant-name">
                ${escapeHTML(String(name))}
            </span>

            <span class="home-participant-payment">
                ${escapeHTML(paymentLabel)}
            </span>

        </div>
    `;
    }

    /* =====================================================
   HOME PAYMENT BREAKDOWN
===================================================== */

    function renderHomePaymentBreakdown(
        offerId,
        participants
    ) {

        if (!Array.isArray(participants)) {
            participants = [];
        }


        /* =================================================
           PAYMENT GROUPS
        ================================================= */

        const groups = {
            bkash: [],
            city_bank: [],
            cash: []
        };


        participants.forEach(participant => {

            if (!participant) {
                return;
            }


            const method =
                String(
                    participant.payment_method ||
                    participant.paymentMethod ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            if (method === "bkash") {

                groups.bkash.push(participant);

            }

            else if (
                method === "city_bank" ||
                method === "citybank"
            ) {

                groups.city_bank.push(participant);

            }

            else if (method === "cash") {

                groups.cash.push(participant);

            }

        });


        /* =================================================
           RENDER EACH PAYMENT METHOD
        ================================================= */

        renderHomePaymentPeople(
            offerId,
            "bkash",
            groups.bkash,
            "No bKash payments."
        );


        renderHomePaymentPeople(
            offerId,
            "city_bank",
            groups.city_bank,
            "No City Bank payments."
        );


        renderHomePaymentPeople(
            offerId,
            "cash",
            groups.cash,
            "No cash payments."
        );

    }

    /* =====================================================
   HOME PAYMENT PEOPLE
===================================================== */

    function renderHomePaymentPeople(
        offerId,
        method,
        participants,
        emptyMessage
    ) {

        const container =
            document.querySelector(
                `[data-payment-people="${method}"][data-offer="${offerId}"]`
            );


        if (!container) {
            return;
        }


        /* =================================================
           NO PAYMENTS
        ================================================= */

        if (!participants.length) {

            container.innerHTML = `
            <div class="home-payment-empty">
                ${escapeHTML(emptyMessage)}
            </div>
        `;

            return;
        }


        /* =================================================
           PARTICIPANTS
        ================================================= */

        container.innerHTML =
            participants
                .map(participant => {

                    const name =
                        participant.full_name ||
                        participant.fullName ||
                        participant.name ||
                        "Unknown";


                    const amount =
                        Number(
                            participant.amount
                        ) || 0;


                    return `
                    <div class="home-payment-person">

                        <span class="home-payment-person-name">
                            ${escapeHTML(name)}
                        </span>

                        <strong class="home-payment-person-amount">
                            ৳${amount.toFixed(2)}
                        </strong>

                    </div>
                `;

                })
                .join("");

    }


    /* =====================================================
            CREATE PAYMENT PERSON ROW
    ===================================================== */

    function createHomePaymentPersonRow(
        participant
    ) {

        const name =
            participant.full_name ||
            participant.fullName ||
            participant.name ||
            "Unknown";


        const amount =
            Number(
                participant.amount
            ) || 0;


        return `
        <div class="home-payment-person">

            <span class="home-payment-person-name">
                ${escapeHTML(name)}
            </span>

            <strong class="home-payment-person-amount">
                ৳${amount.toFixed(2)}
            </strong>

        </div>
    `;

    }


    /* =====================================================
       UPDATE HOME PAYMENT SUMMARY
    ===================================================== */

    function updateHomePaymentSummary(
        offerId,
        method,
        amount
    ) {

        const elements =
            document.querySelectorAll(
                `[data-payment-summary="${method}"][data-offer="${offerId}"]`
            );

        if (!elements.length) {
            return;
        }

        const value =
            Number(amount) || 0;

        elements.forEach(element => {
            element.textContent =
                `৳${value.toFixed(2)}`;
        });
    }

    

    function updateHomePaymentBreakdown(
        offerId,
        method,
        amount
    ) {

        const element =
            document.querySelector(
                `[data-payment-breakdown="${method}"][data-offer="${offerId}"]`
            );

        if (!element) {
            return;
        }

        const value =
            Number(amount) || 0;

        element.textContent =
            `৳${value.toFixed(2)}`;
    }

    /* =====================================================
   UPDATE HOME PAYMENT PEOPLE
===================================================== */

    

    function updateHomePaymentCount(
        offerId,
        method,
        count
    ) {

        const element =
            document.querySelector(
                `[data-payment-count="${method}"][data-offer="${offerId}"]`
            );

        if (!element) {
            return;
        }

        const value =
            Number(count) || 0;

        element.textContent =
            value === 1
                ? "1 Person"
                : `${value} People`;
    }




    /* =====================================================
       ACTIVE OFFER CHECK
    ===================================================== */

    function isActiveOffer(offer) {

        if (!offer) {
            return false;
        }


        const status =
            String(offer.status || "")
                .trim()
                .toUpperCase();


        /*
         * Your current backend data shows:
         *
         * OPEN
         * ENDED
         * completed
         * dismissed
         *
         * Only OPEN should appear under
         * "My Offers".
         */
        return status === "OPEN";

    }


    /* =====================================================
       MY OFFERS
    ===================================================== */

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
            offers
                .map(createMyOfferCard)
                .join("");
    }


    /* =====================================================
       JOINED OFFERS
    ===================================================== */

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
            offers
                .map(createJoinedOfferCard)
                .join("");
    }


    /* =====================================================
       MY OFFER CARD
    ===================================================== */

    function createMyOfferCard(offer) {

        const participantCount =
            Number(
                offer.participant_count ??
                offer.joined_count ??
                offer.joined ??
                0
            );

        const maxPeople =
            Number(
                offer.max_people ??
                offer.maxParticipants ??
                offer.max_participants ??
                0
            );

        const foodPrice =
            Number(
                offer.food_price ??
                offer.foodPrice ??
                0
            );

        const deliveryCharge =
            Number(
                offer.delivery_charge ??
                offer.deliveryCharge ??
                0
            );

        const deliveryPerPerson =
            maxPeople > 0
                ? deliveryCharge / maxPeople
                : 0;

        const costPerPerson =
            foodPrice + deliveryPerPerson;

        const totalAmount =
            costPerPerson * participantCount;

        const progress =
            maxPeople > 0
                ? Math.min(
                    100,
                    Math.round(
                        (
                            participantCount /
                            maxPeople
                        ) * 100
                    )
                )
                : 0;

        /* =================================================
                 PAYMENT METHOD VISIBILITY
        ================================================= */

        const bkashEnabled =
            Number(
                offer.payment_bkash_enabled
            ) === 1;


        const cityBankEnabled =
            Number(
                offer.payment_citybank_enabled
            ) === 1;


        const cashEnabled =
            Number(
                offer.payment_cash_enabled
            ) === 1;

        return `
            <article
                class="home-offer-card"
                data-home-offer-id="${offer.id}">

                <div class="home-offer-header">

                    <div class="home-offer-title">

                        <h3>
                            ${escapeHTML(
            offer.food_name ||
            offer.foodName ||
            "Food Offer"
        )}
                        </h3>

                        <p>
                            ${escapeHTML(
            offer.restaurant_name ||
            offer.restaurantName ||
            "-"
        )}
                        </p>

                    </div>

                    <div class="home-offer-status">

                        <span
                            class="home-status home-status-active">
                            ● Active
                        </span>

                        <span
                            class="home-offer-countdown"
                            data-countdown="${offer.id}">
                            ${formatCountdown(
            offer.end_time ||
            offer.endTime
        )}
                        </span>

                    </div>

                </div>


                <div class="home-offer-stats">

                    <div class="home-offer-stat">

                        <span>
                            Joined
                        </span>

                        <strong>
                            ${participantCount} / ${maxPeople}
                        </strong>

                    </div>


                    <div class="home-offer-stat">

                        <span>
                            Progress
                        </span>

                        <strong>
                            ${progress}%
                        </strong>

                    </div>


                    <div class="home-offer-stat">

                        <span>
                            Cost per person
                        </span>

                        <strong>
                            ৳${costPerPerson.toFixed(2)}
                        </strong>

                    </div>

                </div>


                <div class="home-offer-progress">

                    <div
                        class="home-offer-progress-track">

                        <div
                            class="home-offer-progress-fill"
                            style="width:${progress}%">
                        </div>

                    </div>

                </div>


                <div class="home-offer-management">

                    <button
                        class="button button-primary button-small"
                        type="button"
                        data-manage-offer="${offer.id}">
                        Manage Offer
                    </button>

                    <button
                        class="button button-secondary button-small"
                        type="button"
                        data-edit-offer="${offer.id}">
                        Edit Offer
                    </button>

                    <button
                        class="button button-danger button-small"
                        type="button"
                        data-dismiss-offer="${offer.id}">
                        Dismiss Offer
                    </button>

                </div>


                <div class="home-financial-section">

                    <div class="home-subsection-heading">
                        <span>
                            Financial Summary
                        </span>
                    </div>

                    <div class="home-financial-grid">

                        <div class="home-financial-item">

                            <span>
                                Food Price
                            </span>

                            <strong>
                                ৳${foodPrice.toFixed(2)}
                            </strong>

                        </div>


                        <div class="home-financial-item">

                            <span>
                                Delivery Charge
                            </span>

                            <strong>
                                ৳${deliveryCharge.toFixed(2)}
                            </strong>

                        </div>


                        <div class="home-financial-item">

                            <span>
                                Total Amount
                            </span>

                            <strong>
                                ৳${totalAmount.toFixed(2)}
                            </strong>

                        </div>


                        <div class="home-financial-item">

                            <span>
                                Max Participants
                            </span>

                            <strong>
                                ${maxPeople}
                            </strong>

                        </div>

                    </div>

                </div>


                <div class="home-people-section">

                    <div class="home-subsection-heading">

                        <span>
                            People Joined
                        </span>

                        <strong>
                            (${participantCount})
                        </strong>

                    </div>

                    <div
                        class="home-participants-list"
                        data-home-participants="${offer.id}">

                        <div class="home-participants-loading">
                            Open Manage Offer to view participants.
                        </div>

                    </div>

                </div>


        <div class="home-payment-section">

    <!-- ==========================================
         PAYMENT BREAKDOWN
    =========================================== -->

    <div class="home-subsection-heading">

        <span>
            Payment Breakdown
        </span>

    </div>


    <div
        class="home-payment-breakdown"
        data-payment-breakdown="${offer.id}">


        <!-- ======================================
             BKASH
        ======================================= -->

        <div class="home-payment-method home-payment-bkash"
        ${bkashEnabled ? "" : "hidden"}>

            <div class="home-payment-method-header">

                <div class="home-payment-method-info">

                    <span class="home-payment-method-title">
                        bKash
                    </span>

                    <span
                        class="home-payment-method-count"
                        data-payment-count="bkash"
                        data-offer="${offer.id}">
                        0 People
                    </span>

                </div>

                <strong
                    class="home-payment-method-total"
                    data-payment-breakdown="bkash"
                    data-offer="${offer.id}">
                    ৳0.00
                </strong>

            </div>


            <div
                class="home-payment-people"
                data-payment-people="bkash"
                data-offer="${offer.id}">

                <div class="home-payment-empty">
                    No bKash payments.
                </div>

            </div>

        </div>


        <!-- ======================================
             CITY BANK
        ======================================= -->

        <div class="home-payment-method home-payment-citybank"
        ${cityBankEnabled ? "" : "hidden"}>

            <div class="home-payment-method-header">

                <div class="home-payment-method-info">

                    <span class="home-payment-method-title">
                        City Bank
                    </span>

                    <span
                        class="home-payment-method-count"
                        data-payment-count="city_bank"
                        data-offer="${offer.id}">
                        0 People
                    </span>

                </div>

                <strong
                    class="home-payment-method-total"
                    data-payment-breakdown="city_bank"
                    data-offer="${offer.id}">
                    ৳0.00
                </strong>

            </div>


            <div
                class="home-payment-people"
                data-payment-people="city_bank"
                data-offer="${offer.id}">

                <div class="home-payment-empty">
                    No City Bank payments.
                </div>

            </div>

        </div>


        <!-- ======================================
             CASH
        ======================================= -->

        <div class="home-payment-method home-payment-cash"
        ${cashEnabled ? "" : "hidden"}>

            <div class="home-payment-method-header">

                <div class="home-payment-method-info">

                    <span class="home-payment-method-title">
                        Cash
                    </span>

                    <span
                        class="home-payment-method-count"
                        data-payment-count="cash"
                        data-offer="${offer.id}">
                        0 People
                    </span>

                </div>

                <strong
                    class="home-payment-method-total"
                    data-payment-breakdown="cash"
                    data-offer="${offer.id}">
                    ৳0.00
                </strong>

            </div>


            <div
                class="home-payment-people"
                data-payment-people="cash"
                data-offer="${offer.id}">

                <div class="home-payment-empty">
                    No cash payments.
                </div>

            </div>

        </div>

    </div>


    <!-- ==========================================
         PAYMENT SUMMARY
    =========================================== -->

    <div class="home-payment-summary-card">

        <div class="home-payment-summary-heading">
            Payment Summary
        </div>


        <div class="home-payment-summary-row">

            <span>
                bKash Total
            </span>

            <strong
                data-payment-summary="bkash"
                data-offer="${offer.id}">
                ৳0.00
            </strong>

        </div>


        <div class="home-payment-summary-row">

            <span>
                City Bank Total
            </span>

            <strong
                data-payment-summary="city_bank"
                data-offer="${offer.id}">
                ৳0.00
            </strong>

        </div>


        <div class="home-payment-summary-row">

            <span>
                Cash Total
            </span>

            <strong
                data-payment-summary="cash"
                data-offer="${offer.id}">
                ৳0.00
            </strong>

        </div>


        <div class="home-payment-summary-divider"></div>


        <div class="home-payment-summary-row home-payment-grand-total">

            <span>
                Grand Total
            </span>

            <strong
                data-payment-summary="total"
                data-offer="${offer.id}">
                ৳0.00
            </strong>

        </div>

    </div>

</div>

            </article>
        `;
    }


    /* =====================================================
       JOINED OFFER CARD
    ===================================================== */

    function createJoinedOfferCard(offer) {

        const participantCount =
            Number(
                offer.participant_count ??
                offer.joined_count ??
                offer.joined ??
                0
            );

        const maxPeople =
            Number(
                offer.max_people ??
                offer.maxParticipants ??
                offer.max_participants ??
                0
            );

        return `
            <article
                class="offer-card"
                data-home-offer-id="${offer.id}">

                <div class="offer-card-header">

                    <div>

                        <h3>
                            ${escapeHTML(
            offer.food_name ||
            offer.foodName ||
            "Food Offer"
        )}
                        </h3>

                        <p class="offer-restaurant">
                            ${escapeHTML(
            offer.restaurant_name ||
            offer.restaurantName ||
            "-"
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
            offer.fullName ||
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
            offer.end_time ||
            offer.endTime
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


    /* =====================================================
       MANAGE OFFER
    ===================================================== */

    async function openManageOffer(offerId) {

        const offer =
            allOffers.find(
                item =>
                    Number(item.id) ===
                    Number(offerId)
            );

        if (!offer) {

            showToast(
                "Offer not found."
            );

            return;
        }

        if (!isMyOffer(offer)) {

            showToast(
                "Only the creator can manage this offer."
            );

            return;
        }

        currentManageOffer = offer;

        if (manageSection) {
            manageSection.hidden = false;
        }

        if (manageFoodElement) {
            manageFoodElement.textContent =
                offer.food_name ||
                offer.foodName ||
                "-";
        }

        if (manageRestaurantElement) {
            manageRestaurantElement.textContent =
                offer.restaurant_name ||
                offer.restaurantName ||
                "-";
        }

        if (manageEndElement) {
            manageEndElement.textContent =
                formatDateTime(
                    offer.end_time ||
                    offer.endTime
                );
        }

        updateManageStatus();

        await loadParticipants(
            offer.id
        );

        if (manageSection) {

            manageSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }


    function closeManageOffer() {

        currentManageOffer = null;

        if (manageSection) {
            manageSection.hidden = true;
        }
    }


    /* =====================================================
       MANAGE STATUS
    ===================================================== */

    function updateManageStatus() {

        if (
            !currentManageOffer ||
            !manageStatusElement
        ) {
            return;
        }

        const status =
            String(
                currentManageOffer.status ||
                "OPEN"
            ).toUpperCase();

        manageStatusElement.className =
            "status-pill";

        if (status === "SUCCESSFUL") {

            manageStatusElement.textContent =
                "Successful";

            manageStatusElement.classList.add(
                "home-status",
                "home-status-successful"
            );

            if (endOfferButton) {
                endOfferButton.disabled = true;
            }

            return;
        }


        if (
            status === "ENDED" ||
            status === "DISMISSED" ||
            status === "COMPLETED"
        ) {

            manageStatusElement.textContent =
                "Ended";

            manageStatusElement.classList.add(
                "home-status",
                "home-status-ended"
            );

            if (endOfferButton) {
                endOfferButton.disabled = true;
            }

            return;
        }


        manageStatusElement.textContent =
            "Active";

        manageStatusElement.classList.add(
            "home-status",
            "home-status-active"
        );

        if (endOfferButton) {
            endOfferButton.disabled = false;
        }
    }


    /* =====================================================
       PARTICIPANTS
    ===================================================== */

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

            const response =
                await fetch(
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

            const participants =
                Array.isArray(result)
                    ? result
                    : (
                        result.participants ||
                        []
                    );

            renderParticipants(
                participants
            );

        } catch (error) {

            console.error(
                "HOME PARTICIPANTS ERROR:",
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


    function renderParticipants(
        participants
    ) {

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

        if (manageCountElement) {

            manageCountElement.textContent =
                `${total} / ${maxPeople}`;
        }

        if (successBox) {

            successBox.hidden = !(
                total > 0 &&
                received === total
            );
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
            participants
                .map(createParticipantRow)
                .join("");
    }


    function createParticipantRow(
        participant
    ) {

        const received =
            Number(
                participant.food_received
            ) === 1;

        const name =
            participant.full_name ||
            participant.fullName ||
            "Unknown";

        const initials =
            getInitials(name);

        let avatar = initials;

        if (participant.profile_picture) {

            avatar = `
                <img
                    src="${escapeHTML(
                participant.profile_picture
            )}"
                    alt=""
                />
            `;
        }

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


    /* =====================================================
       FOOD RECEIVED
    ===================================================== */

    async function updateFoodReceived(
        userId,
        received
    ) {

        if (!currentManageOffer) {
            return;
        }

        try {

            const response =
                await fetch(
                    `${API}/offers/${currentManageOffer.id}/participants/${userId}/received`,
                    {
                        method: "PATCH",

                        credentials: "include",

                        headers: {
                            "Content-Type":
                                "application/json"
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
                "HOME FOOD RECEIVED ERROR:",
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


    /* =====================================================
       END OFFER
    ===================================================== */

    async function endCurrentOffer() {

        if (!currentManageOffer) {
            return;
        }

        const status =
            String(
                currentManageOffer.status ||
                "OPEN"
            ).toUpperCase();

        if (status !== "OPEN") {
            return;
        }

        const confirmed =
            window.confirm(
                "Are you sure you want to end this offer?\n\nPeople will no longer be able to join it."
            );

        if (!confirmed) {
            return;
        }

        try {

            const response =
                await fetch(
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
                "HOME END OFFER ERROR:",
                error
            );

            showToast(
                error.message ||
                "Failed to end offer."
            );
        }
    }


    /* =====================================================
       DISMISS OFFER
    ===================================================== */

    async function dismissOffer(offerId) {

        const offer =
            allOffers.find(
                item =>
                    Number(item.id) ===
                    Number(offerId)
            );

        if (!offer) {
            return;
        }

        if (!isMyOffer(offer)) {
            return;
        }

        const confirmed =
            window.confirm(
                "Are you sure you want to dismiss this offer?"
            );

        if (!confirmed) {
            return;
        }

        try {

            const response =
                await fetch(
                    `${API}/offers/${offerId}/dismiss`,
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
                    "Failed to dismiss offer."
                );
            }

            showToast(
                "Offer dismissed successfully."
            );

            await loadOffers();

        } catch (error) {

            console.error(
                "HOME DISMISS ERROR:",
                error
            );

            showToast(
                error.message ||
                "Failed to dismiss offer."
            );
        }
    }


    /* =====================================================
       EDIT OFFER
    ===================================================== */

    function editOffer(offerId) {

        window.location.href =
            `create-offer.html?edit=${encodeURIComponent(
                offerId
            )}`;
    }


    /* =====================================================
       COUNTDOWN
    ===================================================== */

    function updateCountdowns() {

        document
            .querySelectorAll(
                "[data-countdown]"
            )
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

                element.textContent =
                    formatCountdown(
                        offer.end_time ||
                        offer.endTime
                    );
            });


        if (
            currentManageOffer &&
            manageTimeElement
        ) {

            manageTimeElement.textContent =
                formatCountdown(
                    currentManageOffer.end_time ||
                    currentManageOffer.endTime
                );
        }
    }


    /* =====================================================
       LOGOUT
    ===================================================== */

    async function logout() {

        try {

            await fetch(
                `${API}/auth/logout`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

        } catch (error) {

            console.error(
                "HOME LOGOUT ERROR:",
                error
            );
        }

        window.location.href =
            "index.html";
    }


    /* =====================================================
       EVENT DELEGATION
    ===================================================== */

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


            const editButton =
                event.target.closest(
                    "[data-edit-offer]"
                );

            if (editButton) {

                editOffer(
                    editButton.dataset.editOffer
                );

                return;
            }


            const dismissButton =
                event.target.closest(
                    "[data-dismiss-offer]"
                );

            if (dismissButton) {

                dismissOffer(
                    dismissButton.dataset.dismissOffer
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


    /* =====================================================
       BUTTON LISTENERS
    ===================================================== */

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


    if (logoutButtonHome) {

        logoutButtonHome.addEventListener(
            "click",
            logout
        );
    }


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initHome() {

        const authenticated =
            await loadCurrentUser();

        if (!authenticated) {
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


})();