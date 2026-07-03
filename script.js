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
const participantsElement = document.querySelector("[data-participants]");
const totalCostElement = document.querySelector("[data-total-cost]");
const perHeadElement = document.querySelector("[data-per-head]");
const deliveryElement = document.querySelector("[data-delivery]");
const logoutButton = document.querySelector("[data-logout]");
const dashboardViewButtons = document.querySelectorAll("[data-dashboard-view]");
const dashboardViews = document.querySelectorAll("[data-view-panel]");
const profileForm = document.querySelector("[data-profile-form]");
const passwordForm = document.querySelector("[data-password-form]");
const deleteForm = document.querySelector("[data-delete-form]");
const toastStack = document.querySelector("[data-toast-stack]");
const resetTokenInput = document.querySelector("[data-reset-token]");
const authTabs = document.querySelector(".auth-tabs");

const API_BASE = "http://localhost:8080/api";
let currentUser = null;
let refreshTimer = null;

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
    throw new Error(data.error || "Something went wrong.");
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

function showDashboard(user) {
  currentUser = user;
  closeModal();
  landingPage.classList.remove("is-active");
  dashboardPage.classList.add("is-active");
  profileInitial.textContent = user.fullName.trim().charAt(0).toUpperCase() || "U";
  userNameElement.textContent = user.fullName;
  populateProfileForm(user);
  setDashboardView("home");
  renderNews();
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

function renderNews() {
  if (!newsList) {
    return;
  }

  const duplicatedItems = [...newsItems, ...newsItems];
  newsList.innerHTML = duplicatedItems
    .map(
      (item) => `
        <li>
          <strong>${item.title}</strong>
          <span>${item.detail}</span>
        </li>
      `,
    )
    .join("");
}

function refreshOrderNumbers() {
  const participants = 8 + Math.floor(Math.random() * 4);
  const totalCost = participants * 150;
  const deliveryCharge = Math.max(15, Math.round(160 / participants));

  participantsElement.textContent = participants;
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

bootstrap();
