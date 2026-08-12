/* =========================================================
   FOOD HUNT — ADMIN PANEL
   ========================================================= */

const API = "/api";

const state = {
  offers: [],
  users: [],
  pendingConfirmAction: null,
  activity: loadActivity(),
};

/* =========================================================
   DOM
   ========================================================= */

const sidebar = document.getElementById("adminSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const menuButton = document.getElementById("menuButton");
const sidebarClose = document.getElementById("sidebarClose");
const pageTitle = document.getElementById("pageTitle");
const toastStack = document.getElementById("toastStack");

const offerModal = document.getElementById("offerModal");
const confirmModal = document.getElementById("confirmModal");

/* =========================================================
   Initialization
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindSidebar();
  bindModals();
  bindOfferActions();
  bindUserSearch();
  bindSettings();
  bindRefresh();
  bindLogout();

  renderActivity();
  renderDashboardActivity();
  loadAdminData();
});

/* =========================================================
   Navigation
   ========================================================= */

function bindNavigation() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-section]");

    if (!target) return;

    const section = target.dataset.section;

    if (!section) return;

    showSection(section);
  });
}

function showSection(section) {
  document.querySelectorAll(".admin-nav-link").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.section === section
    );
  });

  document.querySelectorAll(".admin-section").forEach((panel) => {
    panel.classList.toggle(
      "is-active",
      panel.dataset.sectionPanel === section
    );
  });

  const titles = {
    dashboard: "Dashboard",
    offers: "Offers",
    users: "Users",
    orders: "Orders",
    restaurants: "Restaurants",
    reports: "Reports",
    issues: "Reports / Issues",
    activity: "Activity Logs",
    settings: "Settings",
    profile: "Admin Profile",
  };

  if (pageTitle) {
    pageTitle.textContent = titles[section] || "Dashboard";
  }

  closeSidebar();
}

/* =========================================================
   Sidebar
   ========================================================= */

function bindSidebar() {
  menuButton?.addEventListener("click", openSidebar);
  sidebarClose?.addEventListener("click", closeSidebar);
  sidebarOverlay?.addEventListener("click", closeSidebar);
}

function openSidebar() {
  sidebar?.classList.add("is-open");
  sidebarOverlay?.classList.add("is-open");
}

function closeSidebar() {
  sidebar?.classList.remove("is-open");
  sidebarOverlay?.classList.remove("is-open");
}

/* =========================================================
   API
   ========================================================= */

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";

  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.message
        ? data.message
        : typeof data === "object" && data?.error
          ? data.error
          : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}

/* =========================================================
   Data Loading
   ========================================================= */

async function loadAdminData() {
  try {
    const offers = await tryRequest([
      "/admin/offers",
      "/offers",
    ]);

    state.offers = normalizeOffers(offers);

    renderOffers();
    renderDashboardOffers();
    updateSummary();
  } catch (error) {
    console.warn("Offer loading:", error.message);

    state.offers = [];

    renderOffers();
    renderDashboardOffers();
    updateSummary();
  }

  try {
    const users = await tryRequest([
      "/admin/users",
      "/users",
    ]);

    state.users = normalizeUsers(users);

    renderUsers();
    updateSummary();
  } catch (error) {
    console.warn("User loading:", error.message);

    state.users = [];

    renderUsers();
    updateSummary();
  }
}

async function tryRequest(paths) {
  let lastError;

  for (const path of paths) {
    try {
      return await apiRequest(path);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No endpoint available.");
}

/* =========================================================
   Normalize Offers
   ========================================================= */

function normalizeOffers(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.offers || payload?.data || [];

  return list.map((offer) => ({
    ...offer,

    id:
      offer.id ??
      offer.offerId,

    restaurantName:
      offer.restaurantName ??
      offer.restaurant ??
      offer.restaurant_name ??
      "Unknown restaurant",

    foodName:
      offer.foodName ??
      offer.food ??
      offer.food_name ??
      "Unknown food",

    description:
      offer.description ??
      "",

    price:
      Number(
        offer.price ??
        offer.foodPrice ??
        offer.food_price ??
        0
      ),

    deliveryCharge:
      Number(
        offer.deliveryCharge ??
        offer.delivery_charge ??
        0
      ),

    quantity:
      Number(
        offer.quantity ??
        0
      ),

    maxParticipants:
      Number(
        offer.maxParticipants ??
        offer.max_participants ??
        0
      ),

    participants:
      Number(
        offer.participantsCount ??
        offer.participantCount ??
        offer.participants ??
        0
      ),

    startTime:
      offer.startTime ??
      offer.start_time ??
      offer.startDateTime ??
      "",

    endTime:
      offer.endTime ??
      offer.end_time ??
      offer.endDateTime ??
      "",

    creatorName:
      offer.creatorName ??
      offer.createdByName ??
      offer.userName ??
      offer.creator ??
      "Unknown",
  }));
}

/* =========================================================
   Normalize Users
   ========================================================= */

function normalizeUsers(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.users || payload?.data || [];

  return list.map((user) => ({
    ...user,

    id:
      user.id ??
      user.userId,

    name:
      user.name ??
      user.fullName ??
      "Unknown user",

    email:
      user.email ??
      "—",

    status:
      user.status ??
      "active",

    offers:
      Number(
        user.offerCount ??
        user.offersCount ??
        user.offers ??
        0
      ),

    joined:
      user.createdAt ??
      user.created_at ??
      user.joinedAt ??
      "",
  }));
}

/* =========================================================
   Summary
   ========================================================= */

function updateSummary() {
  const activeOffers = state.offers.filter(
    (offer) => getOfferStatus(offer) === "active"
  );

  const participants = state.offers.reduce(
    (total, offer) =>
      total + Number(offer.participants || 0),
    0
  );

  setText("summaryUsers", state.users.length);
  setText("summaryOffers", state.offers.length);
  setText("summaryActiveOffers", activeOffers.length);
  setText("summaryParticipants", participants);

  setText("offerNavCount", state.offers.length);
  setText("userNavCount", state.users.length);

  setText("reportOffers", state.offers.length);
  setText("reportUsers", state.users.length);
  setText("reportActive", activeOffers.length);
  setText("reportParticipants", participants);
  setText("reportActiveText", activeOffers.length);

  const mostActive = [...state.offers].sort(
    (a, b) =>
      Number(b.participants || 0) -
      Number(a.participants || 0)
  )[0];

  setText(
    "mostActiveOffer",
    mostActive
      ? `${mostActive.restaurantName} — ${mostActive.foodName}`
      : "—"
  );

  setText(
    "averageParticipants",
    state.offers.length
      ? (
          participants /
          state.offers.length
        ).toFixed(1)
      : "0"
  );
}

/* =========================================================
   Offer Actions
   ========================================================= */

function bindOfferActions() {
  document
    .getElementById("offerSearch")
    ?.addEventListener(
      "input",
      renderOffers
    );

  document
    .getElementById("offerStatusFilter")
    ?.addEventListener(
      "change",
      renderOffers
    );

  document
    .getElementById("createOfferButton")
    ?.addEventListener("click", () => {
      showToast(
        "Offer creation will use the existing Food Hunt offer form/API.",
        "success"
      );
    });

  document
    .getElementById("offerEditForm")
    ?.addEventListener(
      "submit",
      saveOffer
    );

  document.addEventListener(
    "click",
    (event) => {
      const action =
        event.target.closest(
          "[data-offer-action]"
        );

      if (!action) return;

      const id =
        action.dataset.offerId;

      const type =
        action.dataset.offerAction;

      if (type === "edit") {
        openOfferEditor(id);
      }

      if (type === "delete") {
        askDeleteOffer(id);
      }

      if (type === "disable") {
        toggleOfferDisabled(id);
      }

      if (type === "view") {
        openOfferEditor(id, true);
      }
    }
  );
}

/* =========================================================
   Render Offers
   ========================================================= */

function renderOffers() {
  const body =
    document.getElementById(
      "offersTableBody"
    );

  if (!body) return;

  const search =
    document
      .getElementById("offerSearch")
      ?.value
      .trim()
      .toLowerCase() || "";

  const status =
    document.getElementById(
      "offerStatusFilter"
    )?.value || "all";

  const filtered =
    state.offers.filter((offer) => {
      const text = [
        offer.restaurantName,
        offer.foodName,
        offer.creatorName,
        offer.description,
      ]
        .join(" ")
        .toLowerCase();

      const offerStatus =
        getOfferStatus(offer);

      return (
        (!search ||
          text.includes(search)) &&
        (status === "all" ||
          offerStatus === status)
      );
    });

  if (!filtered.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">
          No offers found.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = filtered
    .map((offer) => {
      const offerStatus =
        getOfferStatus(offer);

      return `
        <tr>

          <td>
            <strong>
              ${escapeHtml(
                offer.restaurantName
              )}
            </strong>

            <br>

            <span style="color:#777;font-size:.68rem">
              ${escapeHtml(
                offer.foodName
              )}
            </span>
          </td>

          <td>
            ${escapeHtml(
              offer.creatorName
            )}
          </td>

          <td>
            ৳${formatMoney(
              offer.price
            )}
          </td>

          <td>
            ${offer.participants || 0}
            /
            ${
              offer.maxParticipants ||
              offer.quantity ||
              "—"
            }
          </td>

          <td>
            ${formatDate(
              offer.endTime
            )}
          </td>

          <td>
            <span
              class="status-badge status-${offerStatus}"
            >
              ${capitalize(
                offerStatus
              )}
            </span>
          </td>

          <td>
            <div class="action-group">

              <button
                class="table-action"
                data-offer-action="view"
                data-offer-id="${escapeAttr(
                  offer.id
                )}"
              >
                View
              </button>

              <button
                class="table-action"
                data-offer-action="edit"
                data-offer-id="${escapeAttr(
                  offer.id
                )}"
              >
                Edit
              </button>

              <button
                class="table-action danger"
                data-offer-action="delete"
                data-offer-id="${escapeAttr(
                  offer.id
                )}"
              >
                Delete
              </button>

            </div>
          </td>

        </tr>
      `;
    })
    .join("");
}

/* =========================================================
   Dashboard Offers
   ========================================================= */

function renderDashboardOffers() {
  const body =
    document.getElementById(
      "dashboardOffersTable"
    );

  if (!body) return;

  const active =
    state.offers
      .filter((offer) => {
        const status =
          getOfferStatus(offer);

        return (
          status === "active" ||
          status === "full"
        );
      })
      .slice(0, 6);

  if (!active.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">
          No active offers.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = active
    .map(
      (offer) => `
        <tr>

          <td>

            <strong>
              ${escapeHtml(
                offer.foodName
              )}
            </strong>

            <br>

            <span style="color:#777;font-size:.66rem">
              ${escapeHtml(
                offer.restaurantName
              )}
            </span>

          </td>

          <td>
            ${escapeHtml(
              offer.creatorName
            )}
          </td>

          <td>
            ${offer.participants || 0}
            /
            ${offer.maxParticipants || "—"}
          </td>

          <td>

            <span
              class="status-badge status-${getOfferStatus(
                offer
              )}"
            >
              ${capitalize(
                getOfferStatus(
                  offer
                )
              )}
            </span>

          </td>

        </tr>
      `
    )
    .join("");
}

/* =========================================================
   Offer Status
   ========================================================= */

function getOfferStatus(offer) {
  if (
    offer.disabled === true ||
    offer.status === "disabled"
  ) {
    return "disabled";
  }

  if (
    offer.endTime &&
    !Number.isNaN(
      new Date(
        offer.endTime
      ).getTime()
    ) &&
    new Date(
      offer.endTime
    ).getTime() < Date.now()
  ) {
    return "expired";
  }

  if (
    Number(
      offer.maxParticipants
    ) > 0 &&
    Number(
      offer.participants
    ) >= Number(
      offer.maxParticipants
    )
  ) {
    return "full";
  }

  return "active";
}

/* =========================================================
   Offer Editor
   ========================================================= */

function openOfferEditor(
  id,
  readOnly = false
) {
  const offer =
    state.offers.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

  if (!offer) {
    showToast(
      "Offer could not be found.",
      "error"
    );

    return;
  }

  setValue(
    "editOfferId",
    offer.id
  );

  setValue(
    "editRestaurant",
    offer.restaurantName
  );

  setValue(
    "editFood",
    offer.foodName
  );

  setValue(
    "editDescription",
    offer.description
  );

  setValue(
    "editQuantity",
    offer.quantity
  );

  setValue(
    "editPrice",
    offer.price
  );

  setValue(
    "editDelivery",
    offer.deliveryCharge
  );

  setValue(
    "editMaxParticipants",
    offer.maxParticipants
  );

  setValue(
    "editStartTime",
    toDateTimeLocal(
      offer.startTime
    )
  );

  setValue(
    "editEndTime",
    toDateTimeLocal(
      offer.endTime
    )
  );

  const title =
    document.getElementById(
      "offerModalTitle"
    );

  if (title) {
    title.textContent =
      readOnly
        ? "View Offer"
        : "Edit Offer";
  }

  document
    .querySelectorAll(
      "#offerEditForm input, #offerEditForm textarea"
    )
    .forEach((input) => {
      if (
        input.id !==
        "editOfferId"
      ) {
        input.disabled =
          readOnly;
      }
    });

  const saveButton =
    document.querySelector(
      "#offerEditForm .button-primary"
    );

  if (saveButton) {
    saveButton.style.display =
      readOnly
        ? "none"
        : "";
  }

  openModal(
    "offerModal"
  );
}

/* =========================================================
   Save Offer
   ========================================================= */

async function saveOffer(event) {
  event.preventDefault();

  const id =
    document.getElementById(
      "editOfferId"
    )?.value;

  if (!id) {
    showToast(
      "Offer ID is missing.",
      "error"
    );

    return;
  }

  const payload = {
    restaurantName:
      document.getElementById(
        "editRestaurant"
      )?.value.trim() || "",

    foodName:
      document.getElementById(
        "editFood"
      )?.value.trim() || "",

    description:
      document.getElementById(
        "editDescription"
      )?.value.trim() || "",

    quantity:
      Number(
        document.getElementById(
          "editQuantity"
        )?.value || 0
      ),

    price:
      Number(
        document.getElementById(
          "editPrice"
        )?.value || 0
      ),

    deliveryCharge:
      Number(
        document.getElementById(
          "editDelivery"
        )?.value || 0
      ),

    maxParticipants:
      Number(
        document.getElementById(
          "editMaxParticipants"
        )?.value || 0
      ),

    startTime:
      document.getElementById(
        "editStartTime"
      )?.value || "",

    endTime:
      document.getElementById(
        "editEndTime"
      )?.value || "",
  };

  try {
    const updated =
      await apiRequest(
        `/admin/offers/${encodeURIComponent(
          id
        )}`,
        {
          method: "PUT",
          body: JSON.stringify(
            payload
          ),
        }
      );

    const replacement =
      normalizeOffers(
        updated?.offer
          ? [updated.offer]
          : [updated]
      )[0];

    const index =
      state.offers.findIndex(
        (offer) =>
          String(offer.id) ===
          String(id)
      );

    if (
      index !== -1 &&
      replacement
    ) {
      state.offers[index] = {
        ...state.offers[index],
        ...replacement,
      };
    }

    addActivity(
      `Edited offer "${payload.foodName}"`
    );

    closeModal(
      "offerModal"
    );

    renderOffers();
    renderDashboardOffers();
    updateSummary();

    showToast(
      "Offer updated successfully.",
      "success"
    );
  } catch (error) {
    showToast(
      `Could not update offer: ${error.message}`,
      "error"
    );
  }
}

/* =========================================================
   Delete Offer
   ========================================================= */

function askDeleteOffer(id) {
  const offer =
    state.offers.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

  if (!offer) return;

  const title =
    document.getElementById(
      "confirmTitle"
    );

  const message =
    document.getElementById(
      "confirmMessage"
    );

  if (title) {
    title.textContent =
      "Delete this offer?";
  }

  if (message) {
    message.textContent =
      `"${offer.foodName}" from ${offer.restaurantName} will be permanently removed.`;
  }

  state.pendingConfirmAction =
    () => deleteOffer(id);

  openModal(
    "confirmModal"
  );
}

async function deleteOffer(id) {
  const offer =
    state.offers.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

  try {
    await apiRequest(
      `/admin/offers/${encodeURIComponent(
        id
      )}`,
      {
        method: "DELETE",
      }
    );

    state.offers =
      state.offers.filter(
        (item) =>
          String(item.id) !==
          String(id)
      );

    addActivity(
      `Deleted offer "${offer?.foodName || "Unknown offer"}"`
    );

    closeModal(
      "confirmModal"
    );

    renderOffers();
    renderDashboardOffers();
    updateSummary();

    showToast(
      "Offer deleted successfully.",
      "success"
    );
  } catch (error) {
    showToast(
      `Could not delete offer: ${error.message}`,
      "error"
    );
  }
}

/* =========================================================
   Disable / Enable Offer
   ========================================================= */

async function toggleOfferDisabled(id) {
  const offer =
    state.offers.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

  if (!offer) return;

  const nextDisabled =
    !offer.disabled;

  try {
    await apiRequest(
      `/admin/offers/${encodeURIComponent(
        id
      )}/status`,
      {
        method: "PATCH",

        body: JSON.stringify({
          disabled:
            nextDisabled,
        }),
      }
    );

    offer.disabled =
      nextDisabled;

    addActivity(
      `${
        nextDisabled
          ? "Disabled"
          : "Enabled"
      } offer "${offer.foodName}"`
    );

    renderOffers();
    renderDashboardOffers();
    updateSummary();

    showToast(
      `Offer ${
        nextDisabled
          ? "disabled"
          : "enabled"
      }.`,
      "success"
    );
  } catch (error) {
    showToast(
      `Could not change offer status: ${error.message}`,
      "error"
    );
  }
}

/* =========================================================
   Users
   ========================================================= */

function bindUserSearch() {
  document
    .getElementById(
      "userSearch"
    )
    ?.addEventListener(
      "input",
      renderUsers
    );

  document
    .getElementById(
      "userStatusFilter"
    )
    ?.addEventListener(
      "change",
      renderUsers
    );
}

function renderUsers() {
  const body =
    document.getElementById(
      "usersTableBody"
    );

  if (!body) return;

  const search =
    document
      .getElementById(
        "userSearch"
      )
      ?.value
      .trim()
      .toLowerCase() || "";

  const status =
    document.getElementById(
      "userStatusFilter"
    )?.value || "all";

  const filtered =
    state.users.filter(
      (user) => {
        const text =
          `${user.name} ${user.email}`
            .toLowerCase();

        return (
          (!search ||
            text.includes(
              search
            )) &&
          (status === "all" ||
            user.status ===
              status)
        );
      }
    );

  if (!filtered.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">
          No users found.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML =
    filtered
      .map(
        (user) => `
          <tr>

            <td>
              <strong>
                ${escapeHtml(
                  user.name
                )}
              </strong>
            </td>

            <td>
              ${escapeHtml(
                user.email
              )}
            </td>

            <td>
              ${user.offers}
            </td>

            <td>
              ${formatDate(
                user.joined
              )}
            </td>

            <td>

              <span
                class="status-badge status-${
                  user.status ===
                  "disabled"
                    ? "disabled"
                    : "active"
                }"
              >
                ${capitalize(
                  user.status
                )}
              </span>

            </td>

            <td>

              <div class="action-group">

                <button
                  class="table-action"
                  data-user-action="view"
                  data-user-id="${escapeAttr(
                    user.id
                  )}"
                >
                  View
                </button>

                <button
                  class="table-action"
                  data-user-action="disable"
                  data-user-id="${escapeAttr(
                    user.id
                  )}"
                >
                  ${
                    user.status ===
                    "disabled"
                      ? "Enable"
                      : "Disable"
                  }
                </button>

              </div>

            </td>

          </tr>
        `
      )
      .join("");
}

/* =========================================================
   User Actions
   ========================================================= */

document.addEventListener(
  "click",
  async (event) => {
    const action =
      event.target.closest(
        "[data-user-action]"
      );

    if (!action) return;

    const id =
      action.dataset.userId;

    const type =
      action.dataset.userAction;

    if (type === "view") {
      const user =
        state.users.find(
          (item) =>
            String(item.id) ===
            String(id)
        );

      if (!user) return;

      showToast(
        `${user.name} — ${user.email}`,
        "success"
      );
    }

    if (type === "disable") {
      await toggleUserDisabled(
        id
      );
    }
  }
);

async function toggleUserDisabled(id) {
  const user =
    state.users.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

  if (!user) return;

  const nextStatus =
    user.status ===
    "disabled"
      ? "active"
      : "disabled";

  try {
    await apiRequest(
      `/admin/users/${encodeURIComponent(
        id
      )}/status`,
      {
        method: "PATCH",

        body: JSON.stringify({
          status:
            nextStatus,
        }),
      }
    );

    user.status =
      nextStatus;

    addActivity(
      `${
        nextStatus ===
        "disabled"
          ? "Disabled"
          : "Enabled"
      } user "${user.name}"`
    );

    renderUsers();
    updateSummary();

    showToast(
      `User ${
        nextStatus ===
        "disabled"
          ? "disabled"
          : "enabled"
      }.`,
      "success"
    );
  } catch (error) {
    showToast(
      `Could not change user status: ${error.message}`,
      "error"
    );
  }
}

/* =========================================================
   Modals
   ========================================================= */

function bindModals() {
  document.addEventListener(
    "click",
    (event) => {
      const close =
        event.target.closest(
          "[data-close-modal]"
        );

      if (close) {
        closeModal(
          close.dataset.closeModal
        );
      }
    }
  );

  document
    .getElementById(
      "confirmActionButton"
    )
    ?.addEventListener(
      "click",
      async () => {
        if (
          typeof state.pendingConfirmAction ===
          "function"
        ) {
          await state.pendingConfirmAction();
        }

        state.pendingConfirmAction =
          null;
      }
    );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        document
          .querySelectorAll(
            ".modal.is-open"
          )
          .forEach((modal) => {
            modal.classList.remove(
              "is-open"
            );

            modal.setAttribute(
              "aria-hidden",
              "true"
            );
          });
      }
    }
  );
}

function openModal(id) {
  const modal =
    document.getElementById(id);

  if (!modal) return;

  modal.classList.add(
    "is-open"
  );

  modal.setAttribute(
    "aria-hidden",
    "false"
  );
}

function closeModal(id) {
  const modal =
    document.getElementById(id);

  if (!modal) return;

  modal.classList.remove(
    "is-open"
  );

  modal.setAttribute(
    "aria-hidden",
    "true"
  );
}

/* =========================================================
   Activity
   ========================================================= */

function loadActivity() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "foodHuntAdminActivity"
      ) || "[]"
    );
  } catch {
    return [];
  }
}

function addActivity(message) {
  state.activity.unshift({
    message,
    timestamp:
      new Date().toISOString(),
  });

  state.activity =
    state.activity.slice(
      0,
      50
    );

  localStorage.setItem(
    "foodHuntAdminActivity",
    JSON.stringify(
      state.activity
    )
  );

  renderActivity();
  renderDashboardActivity();
}

function renderActivity() {
  const container =
    document.getElementById(
      "activityList"
    );

  if (!container) return;

  if (!state.activity.length) {
    container.innerHTML = `
      <div class="empty-state">
        No admin activity recorded yet.
      </div>
    `;

    return;
  }

  container.innerHTML =
    state.activity
      .map(
        (item) => `
          <div class="activity-item">

            <span class="activity-dot"></span>

            <div>

              <strong>
                Admin action
              </strong>

              <p>
                ${escapeHtml(
                  item.message
                )}
              </p>

              <time>
                ${formatDate(
                  item.timestamp
                )}
              </time>

            </div>

          </div>
        `
      )
      .join("");
}

function renderDashboardActivity() {
  const container =
    document.getElementById(
      "dashboardActivity"
    );

  if (!container) return;

  if (!state.activity.length) {
    container.innerHTML = `
      <div class="empty-state compact">
        No activity yet.
      </div>
    `;

    return;
  }

  container.innerHTML =
    state.activity
      .slice(0, 5)
      .map(
        (item) => `
          <div class="activity-item">

            <span class="activity-dot"></span>

            <div>

              <strong>
                Admin action
              </strong>

              <p>
                ${escapeHtml(
                  item.message
                )}
              </p>

              <time>
                ${formatDate(
                  item.timestamp
                )}
              </time>

            </div>

          </div>
        `
      )
      .join("");
}

/* =========================================================
   Clear Activity
   ========================================================= */

document
  .getElementById(
    "clearActivityButton"
  )
  ?.addEventListener(
    "click",
    () => {
      state.activity = [];

      localStorage.removeItem(
        "foodHuntAdminActivity"
      );

      renderActivity();
      renderDashboardActivity();

      showToast(
        "Local activity log cleared.",
        "success"
      );
    }
  );

/* =========================================================
   Settings
   ========================================================= */

function bindSettings() {
  const form =
    document.getElementById(
      "adminSettingsForm"
    );

  form?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      const name =
        document.getElementById(
          "settingsAdminName"
        )?.value.trim() || "";

      const email =
        document.getElementById(
          "settingsAdminEmail"
        )?.value.trim() || "";

      if (!name) {
        showToast(
          "Please enter an admin name.",
          "error"
        );

        return;
      }

      localStorage.setItem(
        "foodHuntAdminProfile",
        JSON.stringify({
          name,
          email,
        })
      );

      applyAdminProfile({
        name,
        email,
      });

      addActivity(
        "Updated admin profile settings"
      );

      showToast(
        "Admin settings saved.",
        "success"
      );
    }
  );

  const saved =
    localStorage.getItem(
      "foodHuntAdminProfile"
    );

  if (saved) {
    try {
      applyAdminProfile(
        JSON.parse(saved)
      );
    } catch {
      applyAdminProfile({
        name: "Admin",
        email: "",
      });
    }
  } else {
    applyAdminProfile({
      name: "Admin",
      email: "",
    });
  }
}

function applyAdminProfile(
  profile
) {
  const name =
    profile?.name ||
    "Admin";

  const email =
    profile?.email ||
    "admin@example.com";

  setText(
    "adminName",
    name
  );

  setText(
    "profileName",
    name
  );

  setText(
    "profileEmail",
    email
  );

  setValue(
    "settingsAdminName",
    name
  );

  setValue(
    "settingsAdminEmail",
    email
  );

  const avatarLetters =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (word) =>
          word[0]
      )
      .join("")
      .toUpperCase();

  document
    .querySelectorAll(
      ".admin-avatar, .profile-avatar"
    )
    .forEach((element) => {
      element.textContent =
        avatarLetters ||
        "A";
    });
}

/* =========================================================
   Refresh
   ========================================================= */

function bindRefresh() {
  document
    .getElementById(
      "refreshButton"
    )
    ?.addEventListener(
      "click",
      async () => {
        await loadAdminData();

        renderActivity();
        renderDashboardActivity();

        showToast(
          "Admin data refreshed.",
          "success"
        );
      }
    );
}

/* =========================================================
   Logout
   ========================================================= */

function bindLogout() {
  document
    .getElementById(
      "logoutButton"
    )
    ?.addEventListener(
      "click",
      async () => {
        try {
          await apiRequest(
            "/auth/logout",
            {
              method: "POST",
            }
          );
        } catch {
          // Continue to login even if
          // logout API is unavailable.
        }

        window.location.href =
          "/";
      }
    );
}

/* =========================================================
   Toast
   ========================================================= */

function showToast(
  message,
  type = "success"
) {
  if (!toastStack) {
    alert(message);
    return;
  }

  const toast =
    document.createElement(
      "div"
    );

  toast.className =
    `toast toast-${type}`;

  toast.textContent =
    message;

  toastStack.appendChild(
    toast
  );

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

/* =========================================================
   Helpers
   ========================================================= */

function setText(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent =
      value;
  }
}

function setValue(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.value =
      value ?? "";
  }
}

function formatMoney(
  value
) {
  return Number(
    value || 0
  )
    .toFixed(2)
    .replace(
      /\.00$/,
      ""
    );
}

function formatDate(
  value
) {
  if (!value) return "—";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString(
    [],
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function toDateTimeLocal(
  value
) {
  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const pad =
    (number) =>
      String(number)
        .padStart(2, "0");

  return [
    date.getFullYear(),
    pad(
      date.getMonth() + 1
    ),
    pad(
      date.getDate()
    ),
  ].join("-") +
    "T" +
    [
      pad(
        date.getHours()
      ),
      pad(
        date.getMinutes()
      ),
    ].join(":");
}

function capitalize(
  value
) {
  const text =
    String(value || "");

  return (
    text
      .charAt(0)
      .toUpperCase() +
    text.slice(1)
  );
}

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function escapeAttr(
  value
) {
  return escapeHtml(
    value
  );
}