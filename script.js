const landingPage = document.querySelector("#landingPage");
const dashboardPage = document.querySelector("#dashboardPage");
const modal = document.querySelector("[data-modal]");
const openModalButtons = document.querySelectorAll("[data-open-modal]");
const closeModalButton = document.querySelector("[data-close-modal]");
const tabButtons = document.querySelectorAll("[data-auth-tab]");
const switchButtons = document.querySelectorAll("[data-switch-auth]");
const authForms = document.querySelectorAll("[data-auth-form]");
const newsList = document.querySelector("[data-news-list]");
const profileInitial = document.querySelector("[data-profile-initial]");
const userNameElement = document.querySelector("[data-user-name]");
const participantsElement = document.getElementById("summaryPeople");
const totalCostElement = document.getElementById("summaryTotalCost");
const perHeadElement = document.getElementById("summaryPerHead");
const deliveryElement = document.getElementById("summaryDelivery");
const logoutButton = document.querySelector("[data-logout]");
const dashboardViewButtons = document.querySelectorAll("[data-dashboard-view]");
const dashboardViews = document.querySelectorAll("[data-view-panel]");
const profileForm = document.querySelector("[data-profile-form]");
const passwordForm = document.querySelector("[data-password-form]");
const deleteForm = document.querySelector("[data-delete-form]");
const toastStack = document.querySelector("[data-toast-stack]");
const resetTokenInput = document.querySelector("[data-reset-token]");
const authTabs = document.querySelector(".auth-tabs");
const joinButton = document.querySelector(".join-btn");

const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:8080/api"
    : `${window.location.origin}/api`;
let currentUser = null;
let refreshTimer = null;
let countdownInterval = null;
let selectedOffer = null;

const newsItems = [
  {
    title: "Lunch offer: 12% off at Spice Yard Kitchen",
    detail: "Valid for group orders above ৳1,000 before 1:00 PM.",
  },
  {
    title: "Office lunch announcement",
    detail: "Marketing and Product teams are joining the chicken biryani order.",
  },
  {
    title: "Delivery update",
    detail: "Shared delivery charge is now ৳20 per person for the current order.",
  },
  {
    title: "New restaurant discount",
    detail: "Green Bowl is offering free salad for orders with 8 or more participants.",
  },
  {
    title: "Group order update",
    detail: "Two more colleagues joined, lowering the per head delivery charge.",
  },
];

const currency = new Intl.NumberFormat("bn-BD", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "BDT",
});

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      "Something went wrong."
    );
  }

  return data;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function setActiveAuthTab(tabName) {
  authTabs.hidden = tabName === "forgot" || tabName === "reset";

  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tabName);
  });

  authForms.forEach((form) => {
    const isActive = form.dataset.authForm === tabName;
    form.classList.toggle("is-active", isActive);
    const error = form.querySelector(".form-error");
    if (error) {
      error.textContent = "";
    }
  });
}

function openModal(tabName = "login") {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  setActiveAuthTab(tabName);
  setTimeout(() => {
    modal.querySelector(".auth-form.is-active input:not([type='hidden'])")?.focus();
  }, 120);
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function showLanding() {
  landingPage.classList.add("is-active");
  dashboardPage.classList.remove("is-active");
  currentUser = null;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

async function showDashboard(user) {
  currentUser = user;
  closeModal();
  landingPage.classList.remove("is-active");
  dashboardPage.classList.add("is-active");
  profileInitial.textContent = user.fullName.trim().charAt(0).toUpperCase() || "U";
  userNameElement.textContent = user.fullName;
  populateProfileForm(user);
  setDashboardView("home");
  await renderNews();
  refreshOrderNumbers();
  if (!refreshTimer) {
    refreshTimer = setInterval(refreshOrderNumbers, 9000);
  }
}

function setDashboardView(viewName) {
  dashboardViewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.dashboardView === viewName);
  });

  dashboardViews.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === viewName);
  });
}

function populateProfileForm(user) {
  profileForm.fullName.value = user.fullName || "";
  profileForm.email.value = user.email || "";
  profileForm.officeName.value = user.officeName || "";
  profileForm.role.value = user.role || "user";
}

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

      newsList.innerHTML += `
<li class="offer-card" data-offer-id="${offer.id}">

    <div class="offer-header">

        <img
            class="restaurant-logo"
            src="${getRestaurantLogo(offer.restaurant_name)}"
            alt="${offer.restaurant_name}"
        >

        <div class="offer-title">

            <strong>${offer.restaurant_name}</strong>

            <div class="food-name">
                ${offer.food_name}
            </div>

            <small>
                Created by ${offer.full_name}
            </small>

        </div>

        <div class="countdown-badge"
             data-end="${offer.end_time}">
            --
        </div>

    </div>

    <div class="offer-footer">

        <span class="people-badge">
            👥 ${offer.participant_count} / ${offer.max_people}
        </span>

        <span class="price-badge">
            💰 ৳${(
          Number(offer.food_price) +
          Number(offer.delivery_charge) /
          Math.max(1, offer.participant_count)
        ).toFixed(2)}
        </span>

    </div>

    <button
        class="button button-primary news-join-btn"
        data-offer="${offer.id}">
        Join Order
    </button>

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

    updateNewsCountdowns();

  } catch (err) {

    console.error(err);

  }

}

function showOfferSummary(offer) {

  // Left Side (Group Order Summary)

  selectedOffer = offer;

  // Update Join button state
  joinButton.classList.remove("full");

  if (offer.participant_count >= offer.max_people) {

    joinButton.disabled = true;
    joinButton.textContent = "Order Full";
    joinButton.classList.add("full");

  }
  else if (offer.joined) {

    joinButton.disabled = true;
    joinButton.textContent = "✓ Joined";

  }
  else {

    joinButton.disabled = false;
    joinButton.textContent = "Join Order";

  }

  // Continue with the rest of your summary...

  document.getElementById("summaryRestaurant").textContent =
    offer.restaurant_name;

  document.getElementById("summaryFoodName").textContent =
    offer.food_name;

  document.getElementById("summaryDescription").textContent =
    offer.food_description;

  document.getElementById("summaryPeople").textContent =
    `${offer.participant_count} / ${offer.max_people}`;

  startCountdown(offer.endTime || offer.end_time);


  // Right Side (Cost Cards)

  const perHeadCost = Number(offer.food_price);

  const deliveryPerHead =
    Number(offer.delivery_charge) / Number(offer.max_people);

  const totalCost =
    perHeadCost + deliveryPerHead;

  document.getElementById("summaryPerHead").textContent =
    "৳" + perHeadCost.toFixed(2);

  document.getElementById("summaryDelivery").textContent =
    "৳" + deliveryPerHead.toFixed(2);

  document.getElementById("summaryTotalCost").textContent =
    "৳" + totalCost.toFixed(2);

}

async function joinOffer() {

  if (!selectedOffer) {

    showToast(data.message, "success");

    // Update current offer
    selectedOffer.joined = 1;
    selectedOffer.participant_count = data.participantCount;

    // Refresh the summary
    showOfferSummary(selectedOffer);

    joinButton.disabled = true;
    joinButton.textContent = "✓ Joined";
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

function refreshOrderNumbers() {
  const participants = 8 + Math.floor(Math.random() * 4);
  const totalCost = participants * 150;
  const deliveryCharge = Math.max(15, Math.round(160 / participants));

  participantsElement.textContent = `${participants} / ${participants}`;
  totalCostElement.textContent = currency.format(totalCost);
  perHeadElement.textContent = currency.format(Math.round(totalCost / participants));
  deliveryElement.textContent = currency.format(deliveryCharge);
}

async function restoreSession() {
  try {
    const data = await api("/auth/me");
    showDashboard(data.user);
  } catch {
    showLanding();
  }
}

async function handleSignup(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  const data = await api("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  form.reset();
  setActiveAuthTab("login");
  showToast(data.message || "Please verify your email.", "success");

  if (data.verifyUrl) {
    console.info("Dev verification link:", data.verifyUrl);
  }
}

async function handleLogin(form) {
  const formData = new FormData(form);
  const payload = {
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  };

  const data = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  showDashboard(data.user);
  showToast("Welcome back!", "success");
}

async function handleForgotPassword(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  const data = await api("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  form.reset();
  setActiveAuthTab("login");
  showToast(data.message, "success");
}

async function handleResetPassword(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  const data = await api("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  form.reset();
  history.replaceState({}, "", window.location.pathname);
  setActiveAuthTab("login");
  showToast(data.message, "success");
}

async function handleLogout() {
  await api("/auth/logout", { method: "POST" });
  showLanding();
  showToast("Logged out successfully.", "success");
}

async function handleVerifyEmail(token) {
  const data = await api(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  history.replaceState({}, "", window.location.pathname);
  openModal("login");
  showToast(data.message, "success");
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(profileForm).entries());
  const data = await api("/user/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  showDashboard(data.user);
  profileForm.querySelector("[data-profile-message]").textContent = data.message;
}

async function handlePasswordUpdate(event) {
  event.preventDefault();
  const errorElement = passwordForm.querySelector("[data-password-error]");
  errorElement.textContent = "";

  try {
    const payload = Object.fromEntries(new FormData(passwordForm).entries());
    const data = await api("/user/password", {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    passwordForm.reset();
    showToast(data.message, "success");
  } catch (error) {
    errorElement.textContent = error.message;
  }
}

async function handleDeleteAccount(event) {
  event.preventDefault();
  const errorElement = deleteForm.querySelector("[data-delete-error]");
  errorElement.textContent = "";

  if (!window.confirm("Delete your account permanently?")) {
    return;
  }

  try {
    const payload = Object.fromEntries(new FormData(deleteForm).entries());
    const data = await api("/user/account", {
      method: "DELETE",
      body: JSON.stringify(payload),
    });

    deleteForm.reset();
    showLanding();
    showToast(data.message, "success");
  } catch (error) {
    errorElement.textContent = error.message;
  }
}

openModalButtons.forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.openModal || "login"));
});

closeModalButton.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("is-open")) {
    closeModal();
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveAuthTab(button.dataset.authTab));
});

switchButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveAuthTab(button.dataset.switchAuth));
});

authForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorElement = form.querySelector(".form-error");
    errorElement.textContent = "";

    try {
      if (form.dataset.authForm === "signup") {
        await handleSignup(form);
      } else if (form.dataset.authForm === "login") {
        await handleLogin(form);
      } else if (form.dataset.authForm === "forgot") {
        await handleForgotPassword(form);
      } else if (form.dataset.authForm === "reset") {
        await handleResetPassword(form);
      }
    } catch (error) {
      errorElement.textContent = error.message;
    }
  });
});

logoutButton.addEventListener("click", async () => {
  try {
    await handleLogout();
  } catch (error) {
    showToast(error.message, "error");
  }
});

dashboardViewButtons.forEach((button) => {
  button.addEventListener("click", () => setDashboardView(button.dataset.dashboardView));
});

profileForm.addEventListener("submit", async (event) => {
  try {
    await handleProfileUpdate(event);
  } catch (error) {
    profileForm.querySelector("[data-profile-message]").textContent = error.message;
  }
});

passwordForm.addEventListener("submit", handlePasswordUpdate);
deleteForm.addEventListener("submit", handleDeleteAccount);

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("verify")) {
    try {
      await handleVerifyEmail(params.get("verify"));
    } catch (error) {
      openModal("login");
      showToast(error.message, "error");
    }
    return;
  }

  if (params.get("reset")) {
    resetTokenInput.value = params.get("reset");
    openModal("reset");
    return;
  }

  await restoreSession();
}

function startCountdown(endTime) {

  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  function update() {

    const now = new Date();

    const [hour, minute] = endTime.split(":");

    const end = new Date();

    end.setHours(Number(hour));
    end.setMinutes(Number(minute));
    end.setSeconds(0);

    const diff = end - now;

    if (diff <= 0) {

      document.getElementById("summaryStatus").textContent = "Closed";

      clearInterval(countdownInterval);

      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));

    const minutes = Math.floor(
      (diff % (1000 * 60 * 60)) / (1000 * 60)
    );

    const seconds = Math.floor(
      (diff % (1000 * 60)) / 1000
    );

    document.getElementById("summaryStatus").textContent =
      `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  update();

  countdownInterval = setInterval(update, 1000);
}

bootstrap();

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

// Create Offer Button

const createOfferBtn = document.getElementById("createOfferBtn");

if (createOfferBtn) {
  createOfferBtn.addEventListener("click", () => {
    window.location.href = "create-offer.html";
  });
}

if (joinButton) {

  joinButton.addEventListener("click", joinOffer);

}



