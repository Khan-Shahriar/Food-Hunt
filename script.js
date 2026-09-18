const landingPage = document.querySelector("#landingPage");
const dashboardPage = document.querySelector("#dashboardPage");
const modal = document.querySelector("[data-modal]");
const openModalButtons = document.querySelectorAll("[data-open-modal]");
const closeModalButton = document.querySelector("[data-close-modal]");
const tabButtons = document.querySelectorAll("[data-auth-tab]");
const switchButtons = document.querySelectorAll("[data-switch-auth]");
const authForms = document.querySelectorAll("[data-auth-form]");
const profileInitial = document.querySelector("[data-profile-initial]");
const userNameElement = document.querySelector("[data-user-name]");
const logoutButton = document.querySelector("[data-logout]");
const dashboardViewButtons = document.querySelectorAll("[data-dashboard-view]");
const dashboardViews = document.querySelectorAll("[data-view-panel]");
const profileForm = document.querySelector("[data-profile-form]");
const passwordForm = document.querySelector("[data-password-form]");
const deleteForm = document.querySelector("[data-delete-form]");
const toastStack = document.querySelector("[data-toast-stack]");
const resetEmailInput = document.querySelector("[data-reset-email]");
const resetEmailLabel = document.querySelector("[data-reset-email-label]");
const otpInputs = [...document.querySelectorAll("[data-otp]")];
const verifyResetCodeButton = document.querySelector("[data-verify-reset-code]");
const resendResetCodeButton = document.querySelector("[data-resend-reset-code]");
const resetBackEmailButton = document.querySelector("[data-reset-back-email]");
const cancelResetButton = document.querySelector("[data-cancel-reset]");
const newPasswordForm = document.querySelector('[data-auth-form="new-password"]');
const newPasswordInput = document.querySelector("[data-new-password]");
const passwordToggle = document.querySelector("[data-password-toggle]");
const settingsPasswordToggles = document.querySelectorAll("[data-settings-password-toggle]");
const settingsNewPasswordInput = document.querySelector("[data-settings-new-password]");
const settingsPasswordMatch = document.querySelector("[data-password-match]");
const settingsPasswordRules = document.querySelectorAll("[data-settings-rule]");

let resetEmail = "";
let resetToken = "";
const authTabs = document.querySelector(".auth-tabs");
const adminPanelBtn = document.getElementById("adminPanelBtn");

const API_BASE = "/api";
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

  const normalizedUser = {
    id: user?.id,

    fullName:
      user?.fullName ||
      user?.full_name ||
      user?.name ||
      "User",

    email:
      user?.email ||
      "",

    officeName:
      user?.officeName ||
      user?.office_name ||
      "",

    profilePicture:
      user?.profilePicture ||
      user?.profile_picture ||
      null,

    role:
      user?.role ||
      "user",

    emailVerified:
      user?.emailVerified ??
      Boolean(user?.email_verified),

    accountStatus:
      user?.accountStatus ||
      user?.account_status ||
      "active"
  };

  console.log(
    "NORMALIZED USER:",
    normalizedUser
  );

  currentUser = normalizedUser;

  closeModal();

  landingPage.classList.remove("is-active");
  dashboardPage.classList.add("is-active");


  // ==========================================
  // USER HEADER
  // ==========================================

  const fullName =
    String(normalizedUser.fullName || "User").trim();

  if (profileInitial) {
    profileInitial.textContent =
      fullName.charAt(0).toUpperCase() || "U";
  }

  if (userNameElement) {
    userNameElement.textContent =
      fullName;
  }


  // ==========================================
  // PROFILE
  // ==========================================

  populateProfileForm(normalizedUser);


  // ==========================================
  // ADMIN PANEL
  // ==========================================

  if (adminPanelBtn) {

    adminPanelBtn.hidden =
      normalizedUser.role !== "admin";

    console.log(
      "Admin button:",
      normalizedUser.role,
      "hidden:",
      adminPanelBtn.hidden
    );
  }


  // ==========================================
  // DASHBOARD
  // ==========================================

  setDashboardView("home");


  // ==========================================
  // NEWS
  // ==========================================

  try {

    await renderNews();

  } catch (error) {

    console.error(
      "NEWS RENDER ERROR:",
      error
    );

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

  if (!profileForm) {
    return;
  }

  if (profileForm.fullName) {
    profileForm.fullName.value =
      user.fullName || "";
  }

  if (profileForm.email) {
    profileForm.email.value =
      user.email || "";
  }

  if (profileForm.officeName) {
    profileForm.officeName.value =
      user.officeName || "";
  }

  if (profileForm.role) {
    profileForm.role.value =
      user.role || "user";
  }
}



async function restoreSession() {
  try {
    console.log("Checking authentication...");

    const data = await api("/auth/me");

    if (!data || !data.user) {
      console.error("No user returned from /auth/me:", data);
      return;
    }

   

    await showDashboard(data.user);

  } catch (error) {
    console.error("AUTH RESTORE ERROR:", error);

    // Do not force the dashboard back to the landing page here.
    // A failed session check should not destroy the current UI state.
    return;
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
  const email = String(new FormData(form).get("email") || "").trim();

  if (!email) {
    throw new Error("Please enter your email address.");
  }

  const data = await api("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  resetEmail = email;
  if (resetEmailLabel) resetEmailLabel.textContent = email;
  if (resetEmailInput) resetEmailInput.value = email;

  setActiveAuthTab("reset");
  showToast(data.message, "success");
  setTimeout(() => otpInputs[0]?.focus(), 120);
}

async function handleVerifyResetCode() {
  const code = otpInputs.map((input) => input.value).join("");

  if (!/^\d{6}$/.test(code)) {
    throw new Error("Please enter all 6 digits.");
  }

  const data = await api("/auth/verify-reset-code", {
    method: "POST",
    body: JSON.stringify({
      email: resetEmail,
      code,
    }),
  });

  resetToken = data.resetToken;
  setActiveAuthTab("new-password");
  newPasswordInput?.focus();
}

async function handleResetPassword(form) {
  const payload = Object.fromEntries(new FormData(form).entries());

  const data = await api("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      resetToken,
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    }),
  });

  form.reset();
  resetEmail = "";
  resetToken = "";
  otpInputs.forEach((input) => {
    input.value = "";
    input.classList.remove("is-filled");
  });
  history.replaceState({}, "", window.location.pathname);
  setActiveAuthTab("login");
  showToast(data.message, "success");
}

async function resendResetCode() {
  if (!resetEmail) {
    setActiveAuthTab("forgot");
    return;
  }

  await api("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: resetEmail }),
  });

  otpInputs.forEach((input) => {
    input.value = "";
    input.classList.remove("is-filled");
  });

  setActiveAuthTab("reset");
  otpInputs[0]?.focus();
  showToast("A new verification code has been sent.", "success");
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

  const profileMessage =
    profileForm.querySelector("[data-profile-message]");

  profileMessage.textContent = "";

  const avatar = document.querySelector("[data-profile-avatar]");
  const avatarImage = avatar?.querySelector("img");

  const payload = {
    fullName: profileForm.fullName.value,
    email: profileForm.email.value,
    profilePicture: avatarImage?.src || null,
  };

  const data = await api("/user/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  currentUser = data.user;

  profileMessage.textContent = data.message;

  profileInitial.textContent =
    data.user.fullName.trim().charAt(0).toUpperCase() || "U";
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
      } else if (form.dataset.authForm === "new-password") {
        await handleResetPassword(form);
      }
    } catch (error) {
      errorElement.textContent = error.message;
    }
  });
});

otpInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(-1);
    input.classList.toggle("is-filled", Boolean(input.value));

    if (input.value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  });

  input.addEventListener("paste", (event) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (!pasted) return;

    event.preventDefault();

    pasted.split("").forEach((digit, offset) => {
      if (otpInputs[index + offset]) {
        otpInputs[index + offset].value = digit;
        otpInputs[index + offset].classList.add("is-filled");
      }
    });

    otpInputs[Math.min(index + pasted.length, otpInputs.length - 1)].focus();
  });
});

verifyResetCodeButton?.addEventListener("click", async () => {
  const errorElement = document.querySelector('[data-error="reset"]');
  errorElement.textContent = "";

  try {
    verifyResetCodeButton.disabled = true;
    await handleVerifyResetCode();
  } catch (error) {
    errorElement.textContent = error.message;
  } finally {
    verifyResetCodeButton.disabled = false;
  }
});

resendResetCodeButton?.addEventListener("click", async () => {
  const errorElement = document.querySelector('[data-error="reset"]');
  errorElement.textContent = "";

  try {
    resendResetCodeButton.disabled = true;
    await resendResetCode();
  } catch (error) {
    errorElement.textContent = error.message;
  } finally {
    resendResetCodeButton.disabled = false;
  }
});

resetBackEmailButton?.addEventListener("click", () => {
  setActiveAuthTab("forgot");
  if (resetEmailInput) resetEmailInput.value = resetEmail;
});

cancelResetButton?.addEventListener("click", () => {
  resetEmail = "";
  resetToken = "";
  newPasswordForm?.reset();
  setActiveAuthTab("login");
});

passwordToggle?.addEventListener("click", () => {
  if (!newPasswordInput) return;

  const showing = newPasswordInput.type === "text";
  newPasswordInput.type = showing ? "password" : "text";
  passwordToggle.textContent = showing ? "Show" : "Hide";
  passwordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

newPasswordInput?.addEventListener("input", () => {
  const value = newPasswordInput.value;
  const checks = {
    length: value.length >= 8,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };

  Object.entries(checks).forEach(([rule, valid]) => {
    document.querySelector(`[data-rule="${rule}"]`)?.classList.toggle("is-valid", valid);
  });
});

function updateSettingsPasswordRequirements() {
  const value = settingsNewPasswordInput?.value || "";
  const checks = {
    length: value.length >= 8,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };

  settingsPasswordRules.forEach((rule) => {
    rule.classList.toggle("is-valid", Boolean(checks[rule.dataset.settingsRule]));
  });
}

function updateSettingsPasswordMatch() {
  if (!passwordForm || !settingsPasswordMatch) return;

  const newPassword = passwordForm.newPassword?.value || "";
  const confirmPassword = passwordForm.confirmPassword?.value || "";

  settingsPasswordMatch.classList.remove("is-valid", "is-invalid");

  if (!confirmPassword) {
    settingsPasswordMatch.textContent = "";
    return;
  }

  if (newPassword === confirmPassword) {
    settingsPasswordMatch.textContent = "Passwords match.";
    settingsPasswordMatch.classList.add("is-valid");
  } else {
    settingsPasswordMatch.textContent = "Passwords do not match.";
    settingsPasswordMatch.classList.add("is-invalid");
  }
}

settingsPasswordToggles.forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.settingsPasswordToggle;
    const input = passwordForm?.querySelector(
      type === "current"
        ? '[name="currentPassword"]'
        : type === "new"
          ? '[name="newPassword"]'
          : '[name="confirmPassword"]'
    );

    if (!input) return;

    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Show" : "Hide";
    button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });
});

settingsNewPasswordInput?.addEventListener("input", () => {
  updateSettingsPasswordRequirements();
  updateSettingsPasswordMatch();
});

passwordForm?.querySelector('[name="confirmPassword"]')?.addEventListener("input", updateSettingsPasswordMatch);

passwordForm?.addEventListener("reset", () => {
  setTimeout(() => {
    settingsPasswordRules.forEach((rule) => rule.classList.remove("is-valid"));
    settingsPasswordMatch.textContent = "";
    settingsPasswordMatch.classList.remove("is-valid", "is-invalid");
  }, 0);
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
    console.error("Profile update error:", error);
    profileForm.querySelector("[data-profile-message]").textContent =
      error.message || "Profile update failed.";
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

  await restoreSession();
}

bootstrap();

// Create Offer Button

const welcomeCreateOfferBtn = document.getElementById("welcomeCreateOfferBtn");

if (welcomeCreateOfferBtn) {
  welcomeCreateOfferBtn.addEventListener("click", () => {
    window.location.href = "create-offer.html";
  });
}

// Admin Panel Button

if (adminPanelBtn) {
  adminPanelBtn.addEventListener("click", () => {
    window.location.href = "Admin.html";
  });
}





