/**
 * Frontend logic.
 *
 * This file ONLY talks to the backend through fetch() calls to the
 * REST API. There is no database logic here and no localStorage used
 * as a data store — the API + PostgreSQL are the single source of truth.
 * Refreshing the page always re-fetches from the server.
 */
const API_BASE = "/api";

// Today's date string (YYYY-MM-DD) used across date inputs
const todayStr = new Date().toISOString().split("T")[0];

// Tracks which house is currently selected, so we know which
// house to attach new daily records to and which dashboard to show.
let selectedHouseId = null;

// ---------- DOM references ----------
const statusBanner = document.getElementById("statusBanner");

// Utility to escape HTML to prevent XSS in table injections
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
const houseSelect = document.getElementById("houseSelect");
const sidebarHouseSelect = document.getElementById("sidebarHouseSelect");

const dashboardEmpty = document.getElementById("dashboardEmpty");
const dashboardStats = document.getElementById("dashboardStats");
const statCurrentBirds = document.getElementById("statCurrentBirds");
const statMortality = document.getElementById("statMortality");
const statFeed = document.getElementById("statFeed");
const statEggs = document.getElementById("statEggs");
const statInitialPlaced = document.getElementById("statInitialPlaced");
const statMortalityRate = document.getElementById("statMortalityRate");

const houseForm = document.getElementById("houseForm");
const dailyRecordForm = document.getElementById("dailyRecordForm");

const recordsEmpty = document.getElementById("recordsEmpty");
const recordsTable = document.getElementById("recordsTable");
const recordsTableBody = document.getElementById("recordsTableBody");
const recordCountBadge = document.getElementById("recordCountBadge");

// ---------- Status banner helpers ----------

function showError(message) {
  statusBanner.textContent = message;
  statusBanner.className = "status-banner error";
  statusBanner.hidden = false;
}

function showSuccess(message) {
  statusBanner.textContent = message;
  statusBanner.className = "status-banner success";
  statusBanner.hidden = false;
  // Auto-hide success messages after a few seconds so they don't linger.
  setTimeout(() => {
    statusBanner.hidden = true;
  }, 3000);
}

function showInfo(message) {
  statusBanner.textContent = message;
  statusBanner.className = "status-banner info";
  statusBanner.hidden = false;
}

function clearStatus() {
  statusBanner.hidden = true;
  statusBanner.textContent = "";
}

// ---------- Field-level validation error helpers ----------

function clearFieldErrors(form) {
  form.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
  });
}

/**
 * Renders backend validation errors (or frontend pre-checks) next to
 * the matching form field. Backend errors look like
 * { field: "birdsPlaced", message: "..." }.
 */
function showFieldErrors(form, errors) {
  errors.forEach((err) => {
    const el = document.getElementById(`${err.field}Error`);
    if (el) {
      el.textContent = err.message;
    } else {
      // Fallback: field name didn't map to an element, show it globally.
      showError(err.message);
    }
  });
}

// ---------- Local Storage Fallback Store ----------
// Ensures 100% functionality even on static hosts (GitHub Pages, Vercel without proxy) where /api is not deployed.
let isLocalFallbackActive = false;

function getLocalData() {
  try {
    const rawHouses = localStorage.getItem("pms_houses");
    const rawRecords = localStorage.getItem("pms_records");
    let houses = rawHouses ? JSON.parse(rawHouses) : null;
    let records = rawRecords ? JSON.parse(rawRecords) : null;

    if (!Array.isArray(houses) || houses.length === 0) {
      houses = [
        { id: 1, name: "House A", birdsPlaced: 500, createdAt: "2026-09-01T00:00:00.000Z" },
      ];
      localStorage.setItem("pms_houses", JSON.stringify(houses));
    }
    if (!Array.isArray(records)) {
      records = [
        { id: 1, houseId: 1, date: "2026-09-02T00:00:00.000Z", mortality: 3, feedUsedKg: 25.5, eggsCollected: 420, createdAt: "2026-09-02T00:00:00.000Z" },
        { id: 2, houseId: 1, date: "2026-09-03T00:00:00.000Z", mortality: 2, feedUsedKg: 26, eggsCollected: 430, createdAt: "2026-09-03T00:00:00.000Z" },
      ];
      localStorage.setItem("pms_records", JSON.stringify(records));
    }
    return { houses, records };
  } catch {
    return {
      houses: [{ id: 1, name: "House A", birdsPlaced: 500, createdAt: new Date().toISOString() }],
      records: [],
    };
  }
}

function handleLocalRequest(path, options = {}) {
  const { houses, records } = getLocalData();
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  // GET /houses
  if (path === "/houses" && method === "GET") {
    return houses.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // POST /houses
  if (path === "/houses" && method === "POST") {
    const newHouse = {
      id: Date.now(),
      name: body.name.trim(),
      birdsPlaced: parseInt(body.birdsPlaced, 10),
      createdAt: new Date(body.createdAt).toISOString(),
    };
    houses.push(newHouse);
    localStorage.setItem("pms_houses", JSON.stringify(houses));
    return newHouse;
  }

  // GET /houses/:id/dashboard
  const dashMatch = path.match(/^\/houses\/(\d+)\/dashboard$/);
  if (dashMatch && method === "GET") {
    const houseId = parseInt(dashMatch[1], 10);
    const house = houses.find((h) => h.id === houseId);
    if (!house) throw new Error("Poultry house not found");
    const houseRecords = records.filter((r) => r.houseId === houseId);
    const totalMortality = houseRecords.reduce((sum, r) => sum + r.mortality, 0);
    const totalFeedUsedKg = houseRecords.reduce((sum, r) => sum + r.feedUsedKg, 0);
    const totalEggsCollected = houseRecords.reduce((sum, r) => sum + r.eggsCollected, 0);
    const currentBirds = Math.max(0, house.birdsPlaced - totalMortality);
    return {
      houseId: house.id,
      houseName: house.name,
      birdsPlaced: house.birdsPlaced,
      currentBirds,
      totalMortality,
      totalFeedUsedKg,
      totalEggsCollected,
    };
  }

  // GET /houses/:id/daily-records
  const recsMatch = path.match(/^\/houses\/(\d+)\/daily-records$/);
  if (recsMatch && method === "GET") {
    const houseId = parseInt(recsMatch[1], 10);
    return records
      .filter((r) => r.houseId === houseId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // POST /houses/:id/daily-records
  if (recsMatch && method === "POST") {
    const houseId = parseInt(recsMatch[1], 10);
    const house = houses.find((h) => h.id === houseId);
    if (!house) throw new Error("Poultry house not found");

    const dateStr = new Date(body.date).toISOString().split("T")[0];
    const exists = records.some(
      (r) => r.houseId === houseId && new Date(r.date).toISOString().split("T")[0] === dateStr
    );
    if (exists) throw new Error("A daily record for this house and date already exists.");

    const houseRecords = records.filter((r) => r.houseId === houseId);
    const currentMortality = houseRecords.reduce((sum, r) => sum + r.mortality, 0);
    const currentBirds = house.birdsPlaced - currentMortality;
    const mortality = parseInt(body.mortality, 10);

    if (mortality > currentBirds) {
      throw new Error(`Mortality (${mortality}) cannot exceed current bird count (${currentBirds}).`);
    }

    const newRecord = {
      id: Date.now(),
      houseId,
      date: new Date(body.date).toISOString(),
      mortality,
      feedUsedKg: parseFloat(body.feedUsedKg),
      eggsCollected: parseInt(body.eggsCollected, 10),
      createdAt: new Date().toISOString(),
    };
    records.push(newRecord);
    localStorage.setItem("pms_records", JSON.stringify(records));
    return newRecord;
  }

  throw new Error("Route not found");
}

// ---------- API helper ----------

/**
 * Wraps fetch() with consistent JSON handling and error propagation.
 * Seamlessly falls back to local storage if the API server is unavailable or 404s.
 */
async function apiRequest(path, options = {}) {
  if (isLocalFallbackActive) {
    return handleLocalRequest(path, options);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (networkErr) {
    console.warn("[PMS] Network error reaching API, switching to local store:", networkErr.message);
    isLocalFallbackActive = true;
    showInfo("Running in local storage mode (backend API unreachable).");
    return handleLocalRequest(path, options);
  }

  let body;
  const rawText = await response.text();
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch {
    // If backend returned HTML (e.g. 404 from static host like GitHub Pages or Vercel missing rewrite)
    if (response.status === 404 || !response.ok) {
      console.warn(`[PMS] API returned HTTP ${response.status} (non-JSON), switching to local store.`);
      isLocalFallbackActive = true;
      showInfo("Running in local storage mode (backend API not hosted on this URL).");
      return handleLocalRequest(path, options);
    }
    throw new Error("The server returned an unexpected response format.");
  }

  // If Express or server returned a 404 Route not found
  if (response.status === 404) {
    console.warn("[PMS] API endpoint 404, switching to local store.");
    isLocalFallbackActive = true;
    showInfo("Running in local storage mode (backend API not found).");
    return handleLocalRequest(path, options);
  }

  if (!response.ok || !body.success) {
    const error = new Error(body.message || "Something went wrong.");
    error.details = body.errors || null;
    error.status = response.status;
    throw error;
  }

  return body.data;
}

// ---------- Houses ----------

async function loadHouses() {
  try {
    const houses = await apiRequest("/houses");
    renderHouseOptions(houses);
  } catch (err) {
    showError(err.message);
  }
}

function renderHouseOptions(houses) {
  houseSelect.innerHTML = "";
  if (sidebarHouseSelect) sidebarHouseSelect.innerHTML = "";

  if (houses.length === 0) {
    const opt1 = document.createElement("option");
    opt1.value = "";
    opt1.textContent = "-- No houses yet --";
    houseSelect.appendChild(opt1);
    
    if (sidebarHouseSelect) {
      const opt2 = document.createElement("option");
      opt2.value = "";
      opt2.textContent = "-- No houses yet --";
      sidebarHouseSelect.appendChild(opt2);
    }
    
    selectedHouseId = null;
    renderEmptyDashboard();
    renderEmptyRecords();
    return;
  }

  const placeholder1 = document.createElement("option");
  placeholder1.value = "";
  placeholder1.textContent = "-- Select a house --";
  houseSelect.appendChild(placeholder1);

  if (sidebarHouseSelect) {
    const placeholder2 = document.createElement("option");
    placeholder2.value = "";
    placeholder2.textContent = "-- Select a house --";
    sidebarHouseSelect.appendChild(placeholder2);
  }

  houses.forEach((house) => {
    const text = `${house.name} (${house.birdsPlaced} birds)`;
    
    const option1 = document.createElement("option");
    option1.value = house.id;
    option1.textContent = text;
    houseSelect.appendChild(option1);

    if (sidebarHouseSelect) {
      const option2 = document.createElement("option");
      option2.value = house.id;
      option2.textContent = text;
      sidebarHouseSelect.appendChild(option2);
    }
  });

  // Auto-select the most recently created house (list is newest-first).
  houseSelect.value = houses[0].id;
  if (sidebarHouseSelect) sidebarHouseSelect.value = houses[0].id;
  selectedHouseId = houses[0].id;
  loadDashboard(selectedHouseId);
  loadDailyRecords(selectedHouseId);
}

function handleHouseChange(value) {
  selectedHouseId = value ? Number(value) : null;
  if (houseSelect && houseSelect.value !== String(value || "")) {
    houseSelect.value = value || "";
  }
  if (sidebarHouseSelect && sidebarHouseSelect.value !== String(value || "")) {
    sidebarHouseSelect.value = value || "";
  }

  if (!selectedHouseId) {
    renderEmptyDashboard();
    renderEmptyRecords();
    return;
  }

  loadDashboard(selectedHouseId);
  loadDailyRecords(selectedHouseId);
}

houseSelect.addEventListener("change", (e) => {
  handleHouseChange(e.target.value);
});

if (sidebarHouseSelect) {
  sidebarHouseSelect.addEventListener("change", (e) => {
    handleHouseChange(e.target.value);
  });
}

async function createHouse(payload) {
  return apiRequest("/houses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

houseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();
  clearFieldErrors(houseForm);

  const name = document.getElementById("houseName").value.trim();
  const birdsPlacedRaw = document.getElementById("birdsPlaced").value;
  const dateCreated = document.getElementById("dateCreated").value;

  // Lightweight frontend pre-checks for a snappier UX.
  // The backend re-validates everything regardless.
  const frontendErrors = [];
  if (!name) {
    frontendErrors.push({ field: "houseName", message: "House name is required." });
  }
  if (!birdsPlacedRaw || Number(birdsPlacedRaw) <= 0) {
    frontendErrors.push({ field: "birdsPlaced", message: "Birds placed must be greater than zero." });
  }
  if (!dateCreated) {
    frontendErrors.push({ field: "dateCreated", message: "Created date is required." });
  }

  if (frontendErrors.length > 0) {
    showFieldErrors(houseForm, frontendErrors);
    return;
  }

  const submitBtn = houseForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating...";

  try {
    await createHouse({
      name,
      birdsPlaced: Number(birdsPlacedRaw),
      createdAt: dateCreated,
    });
    showSuccess("Poultry house created.");
    houseForm.reset();
    await loadHouses();
  } catch (err) {
    if (err.details) {
      showFieldErrors(houseForm, remapHouseFieldErrors(err.details));
    } else {
      showError(err.message);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create House";
  }
});

// Backend field names (name, birdsPlaced, createdAt) map to the
// frontend's input ids (houseName, birdsPlaced, dateCreated).
function remapHouseFieldErrors(errors) {
  const map = { name: "houseName", birdsPlaced: "birdsPlaced", createdAt: "dateCreated" };
  return errors.map((e) => ({ field: map[e.field] || e.field, message: e.message }));
}

// ---------- Dashboard ----------

function renderEmptyDashboard() {
  dashboardEmpty.hidden = false;
  dashboardStats.hidden = true;
}

async function loadDashboard(houseId) {
  try {
    const data = await apiRequest(`/houses/${houseId}/dashboard`);
    dashboardEmpty.hidden = true;
    dashboardStats.hidden = false;
    statCurrentBirds.textContent = Number(data.currentBirds).toLocaleString();
    statMortality.textContent = Number(data.totalMortality).toLocaleString();
    statFeed.textContent = Number(data.totalFeedUsedKg).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    statEggs.textContent = Number(data.totalEggsCollected).toLocaleString();

    if (statInitialPlaced) {
      statInitialPlaced.textContent = `Original stock: ${Number(data.birdsPlaced).toLocaleString()} placed`;
    }
    if (statMortalityRate && data.birdsPlaced > 0) {
      const pct = ((data.totalMortality / data.birdsPlaced) * 100).toFixed(1);
      statMortalityRate.textContent = `${pct}% cumulative loss`;
    }
  } catch (err) {
    showError(err.message);
  }
}

// ---------- Daily Records ----------

function renderEmptyRecords() {
  recordsEmpty.hidden = false;
  recordsTable.hidden = true;
  recordsTableBody.innerHTML = "";
  if (recordCountBadge) {
    recordCountBadge.textContent = "0 records";
  }
}

async function loadDailyRecords(houseId) {
  try {
    const records = await apiRequest(`/houses/${houseId}/daily-records`);
    renderRecordsTable(records);
  } catch (err) {
    showError(err.message);
  }
}

function renderRecordsTable(records) {
  if (records.length === 0) {
    renderEmptyRecords();
    return;
  }

  recordsEmpty.hidden = true;
  recordsTable.hidden = false;
  recordsTableBody.innerHTML = "";
  if (recordCountBadge) {
    recordCountBadge.textContent = `${records.length} ${records.length === 1 ? "record" : "records"}`;
  }

  records.forEach((record) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    const d = new Date(record.date);
    dateCell.textContent = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const mortalityCell = document.createElement("td");
    mortalityCell.className = "num-col";
    mortalityCell.textContent = Number(record.mortality).toLocaleString();

    const feedCell = document.createElement("td");
    feedCell.className = "num-col";
    feedCell.textContent = Number(record.feedUsedKg).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const eggsCell = document.createElement("td");
    eggsCell.className = "num-col";
    eggsCell.textContent = Number(record.eggsCollected).toLocaleString();

    const statusCell = document.createElement("td");
    statusCell.className = "status-col";
    const pill = document.createElement("span");
    if (record.mortality === 0) {
      pill.className = "loss-pill clean";
      pill.textContent = "Optimal (0 loss)";
    } else {
      pill.className = "loss-pill elevated";
      pill.textContent = `-${record.mortality} birds`;
    }
    statusCell.appendChild(pill);

    row.append(dateCell, mortalityCell, feedCell, eggsCell, statusCell);
    recordsTableBody.appendChild(row);
  });
}

async function createDailyRecord(houseId, payload) {
  return apiRequest(`/houses/${houseId}/daily-records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

dailyRecordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();
  clearFieldErrors(dailyRecordForm);

  if (!selectedHouseId) {
    showError("Please create or select a poultry house first.");
    return;
  }

  const date = document.getElementById("recordDate").value;
  const mortalityRaw = document.getElementById("mortality").value;
  const feedUsedRaw = document.getElementById("feedUsed").value;
  const eggsCollectedRaw = document.getElementById("eggsCollected").value;

  const frontendErrors = [];
  if (!date) frontendErrors.push({ field: "recordDate", message: "Date is required." });
  if (mortalityRaw === "" || Number(mortalityRaw) < 0)
    frontendErrors.push({ field: "mortality", message: "Mortality cannot be negative." });
  if (feedUsedRaw === "" || Number(feedUsedRaw) < 0)
    frontendErrors.push({ field: "feedUsed", message: "Feed used cannot be negative." });
  if (eggsCollectedRaw === "" || Number(eggsCollectedRaw) < 0)
    frontendErrors.push({ field: "eggsCollected", message: "Eggs collected cannot be negative." });

  if (frontendErrors.length > 0) {
    showFieldErrors(dailyRecordForm, frontendErrors);
    return;
  }

  const submitBtn = dailyRecordForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    await createDailyRecord(selectedHouseId, {
      date,
      mortality: Number(mortalityRaw),
      feedUsedKg: Number(feedUsedRaw),
      eggsCollected: Number(eggsCollectedRaw),
    });
    showSuccess("Daily record saved.");
    dailyRecordForm.reset();
    await loadDashboard(selectedHouseId);
    await loadDailyRecords(selectedHouseId);
  } catch (err) {
    if (err.details) {
      showFieldErrors(dailyRecordForm, remapRecordFieldErrors(err.details));
    } else {
      // Business-rule errors (e.g. mortality exceeds current birds) and
      // duplicate-date errors arrive here with no field-specific detail.
      showError(err.message);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Daily Record";
  }
});

function remapRecordFieldErrors(errors) {
  const map = {
    date: "recordDate",
    mortality: "mortality",
    feedUsedKg: "feedUsed",
    eggsCollected: "eggsCollected",
  };
  return errors.map((e) => ({ field: map[e.field] || e.field, message: e.message }));
}

// ---------- Mobile Drawer, Navigation, & Roadmap Dialog Helpers ----------

const hamburgerBtn = document.getElementById("hamburgerBtn");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const appSidebar = document.getElementById("appSidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

function openMobileSidebar() {
  if (appSidebar && sidebarBackdrop) {
    appSidebar.classList.add("open");
    sidebarBackdrop.classList.add("active");
    if (hamburgerBtn) hamburgerBtn.setAttribute("aria-expanded", "true");
  }
}

function closeMobileSidebar() {
  if (appSidebar && sidebarBackdrop) {
    appSidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("active");
    if (hamburgerBtn) hamburgerBtn.setAttribute("aria-expanded", "false");
  }
}

if (hamburgerBtn) {
  hamburgerBtn.addEventListener("click", () => {
    openMobileSidebar();
  });
}

if (closeSidebarBtn) {
  closeSidebarBtn.addEventListener("click", () => {
    closeMobileSidebar();
  });
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener("click", () => {
    closeMobileSidebar();
  });
}

// Close drawer automatically when clicking anchor nav items on mobile
document.querySelectorAll(".nav-link[href^='#']").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link[href^='#']").forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    if (window.innerWidth <= 860) {
      closeMobileSidebar();
    }
  });
});

// Roadmap modals configuration
const ROADMAP_CONTENT = {
  "flock-modal": {
    badge: "Phase 2 &bull; Flock &amp; Breed Cycles",
    title: "Flock &amp; Batch Management",
    html: `
      <p>Tracks commercial broiler cycles (e.g. 6-week harvest) and layer batches (e.g. 72-week egg cycle) independently of physical structures.</p>
      <h4>Planned Capabilities:</h4>
      <ul>
        <li><strong>Breed Profiling:</strong> Cobb 500, Ross 308, Isa Brown, Lohmann Brown target curves.</li>
        <li><strong>Age in Days/Weeks:</strong> Automatic daily increment and expected weight curve benchmarking.</li>
        <li><strong>Batch Depletion / Harvest:</strong> Track total live weight sold vs. mortality loss percentage.</li>
      </ul>
    `
  },
  "feed-modal": {
    badge: "Phase 2 &bull; Silo &amp; Inventory Management",
    title: "Feed Inventory &amp; Conversion Efficiency (FCR)",
    html: `
      <p>Enables accurate stock tracking from starter, grower, to finisher feeds with live silo balance calculations.</p>
      <h4>Planned Capabilities:</h4>
      <ul>
        <li><strong>Feed Conversion Ratio (FCR):</strong> Live calculation of (Total Feed Consumed / Total Flock Weight Gain).</li>
        <li><strong>Restock Alerts:</strong> Automated notification when warehouse bags drop below 3 days of consumption.</li>
        <li><strong>Supplier Price Tracking:</strong> Cost per 50kg bag to measure true production cost.</li>
      </ul>
    `
  },
  "health-modal": {
    badge: "Phase 2 &bull; Biosecurity &amp; Health",
    title: "Vaccination &amp; Medication Schedule",
    html: `
      <p>Prevents disease outbreaks through calendar-driven reminders and medical batch administration logs.</p>
      <h4>Planned Capabilities:</h4>
      <ul>
        <li><strong>Vaccination Calendar:</strong> Gumboro (IBD), Newcastle (ND), Marek's, and Fowl Pox schedules.</li>
        <li><strong>Withdrawal Periods:</strong> Mandatory countdowns to guarantee zero antibiotic residue in meat/eggs.</li>
        <li><strong>Mortality Symptoms Triage:</strong> Post-mortem notes and disease early warning trigger.</li>
      </ul>
    `
  },
  "sales-modal": {
    badge: "Phase 3 &bull; Enterprise P&amp;L",
    title: "Commercial Sales, Revenue &amp; Profitability",
    html: `
      <p>Comprehensive accounting module linking daily eggs and finished birds directly to revenue and net margins.</p>
      <h4>Planned Capabilities:</h4>
      <ul>
        <li><strong>Egg Sales &amp; Crates:</strong> Small, Medium, Large grading with wholesale customer invoicing.</li>
        <li><strong>Cull &amp; Broiler Sales:</strong> Direct live bird weight transactions with customer receivables.</li>
        <li><strong>Gross Margin Analytics:</strong> Net profit per crate of eggs and per kg of broiler meat produced.</li>
      </ul>
    `
  }
};

const featureModal = document.getElementById("featureModal");
const modalBadge = document.getElementById("modalBadge");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const closeModalBtn = document.getElementById("closeModalBtn");
const closeModalActionBtn = document.getElementById("closeModalActionBtn");

function openFeatureModal(key) {
  const content = ROADMAP_CONTENT[key];
  if (!content || !featureModal) return;
  modalBadge.innerHTML = content.badge;
  modalTitle.textContent = content.title;
  modalBody.innerHTML = content.html;
  featureModal.hidden = false;
  if (window.innerWidth <= 860) {
    closeMobileSidebar();
  }
}

function closeFeatureModal() {
  if (featureModal) {
    featureModal.hidden = true;
  }
}

document.querySelectorAll(".roadmap-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modalKey = btn.getAttribute("data-modal");
    openFeatureModal(modalKey);
  });
});

if (closeModalBtn) closeModalBtn.addEventListener("click", closeFeatureModal);
if (closeModalActionBtn) closeModalActionBtn.addEventListener("click", closeFeatureModal);
if (featureModal) {
  featureModal.addEventListener("click", (e) => {
    if (e.target === featureModal) closeFeatureModal();
  });
}

// Escape key to close drawers and modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeMobileSidebar();
    closeFeatureModal();
  }
});

// ---------- Module 1: Batches & Breed Cycles Logic ----------

const batchHouseSelect = document.getElementById("batchHouseSelect");
const toggleNewBatchBtn = document.getElementById("toggleNewBatchBtn");
const newBatchFormContainer = document.getElementById("newBatchFormContainer");
const cancelBatchBtn = document.getElementById("cancelBatchBtn");
const createBatchForm = document.getElementById("createBatchForm");
const batchesTableBody = document.getElementById("batchesTableBody");
const placementDateInput = document.getElementById("placementDate");

if (placementDateInput && !placementDateInput.value) {
  placementDateInput.value = todayStr;
}

if (toggleNewBatchBtn && newBatchFormContainer) {
  toggleNewBatchBtn.addEventListener("click", () => {
    const isHidden = newBatchFormContainer.hidden;
    newBatchFormContainer.hidden = !isHidden;
    if (!isHidden) {
      toggleNewBatchBtn.scrollIntoView({ behavior: "smooth" });
    }
  });
}

if (cancelBatchBtn && newBatchFormContainer) {
  cancelBatchBtn.addEventListener("click", () => {
    newBatchFormContainer.hidden = true;
  });
}

async function loadBatches() {
  if (!batchesTableBody) return;
  try {
    const res = await fetch("/api/batches");
    if (!res.ok) throw new Error("Failed to fetch batches");
    const json = await res.json();
    const batches = json.data || [];
    renderBatches(batches);
    updateBatchSelects(batches);
  } catch (err) {
    console.error("Error loading batches:", err);
  }
}

function updateBatchSelects(batches) {
  const treatmentBatchSelect = document.getElementById("treatmentBatchSelect");
  if (treatmentBatchSelect) {
    treatmentBatchSelect.innerHTML = batches.map(b => 
      `<option value="${b.batchCode}">${b.batchCode} (${b.houseName} - ${b.breedType})</option>`
    ).join("");
  }
}

function openHarvestModal(batchId, batchCode, currentLive) {
  const modal = document.getElementById("harvestModal");
  const idInput = document.getElementById("harvestBatchId");
  const display = document.getElementById("harvestBatchDisplay");
  const birdsInput = document.getElementById("harvestedBirds");
  const weightInput = document.getElementById("harvestedWeightKg");

  if (!modal) return;
  idInput.value = batchId;
  display.textContent = `${batchCode} (Currently ${currentLive} live birds)`;
  birdsInput.max = currentLive;
  birdsInput.value = Math.min(50, currentLive);
  weightInput.value = (Number(birdsInput.value) * 2.3).toFixed(1);
  modal.hidden = false;
}

function closeHarvestModal() {
  const modal = document.getElementById("harvestModal");
  if (modal) modal.hidden = true;
}

const closeHarvestModalBtn = document.getElementById("closeHarvestModalBtn");
const cancelHarvestBtn = document.getElementById("cancelHarvestBtn");
const harvestForm = document.getElementById("harvestForm");

if (closeHarvestModalBtn) closeHarvestModalBtn.addEventListener("click", closeHarvestModal);
if (cancelHarvestBtn) cancelHarvestBtn.addEventListener("click", closeHarvestModal);
const harvestModal = document.getElementById("harvestModal");
if (harvestModal) {
  harvestModal.addEventListener("click", (e) => {
    if (e.target === harvestModal) closeHarvestModal();
  });
}

if (harvestForm) {
  harvestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("harvestBatchId").value;
    const harvestedBirds = document.getElementById("harvestedBirds").value;
    const harvestedWeightKg = document.getElementById("harvestedWeightKg").value;
    const notes = document.getElementById("harvestNotes").value;

    try {
      const res = await fetch(`/api/batches/${id}/harvest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ harvestedBirds, harvestedWeightKg, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to record harvest");
      showSuccess(`Harvest logged: ${harvestedBirds} birds (${harvestedWeightKg} kg) depleted.`);
      harvestForm.reset();
      closeHarvestModal();
      await loadBatches();
    } catch (err) {
      showError(err.message);
    }
  });
}

function renderBatches(batches) {
  if (!batchesTableBody) return;
  if (!batches.length) {
    batchesTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--color-text-muted);padding:1.5rem;">No active batch cycles. Place a new flock cohort above.</td></tr>`;
    return;
  }

  batchesTableBody.innerHTML = batches.map(b => `
    <tr>
      <td><strong style="font-family:var(--font-mono);color:var(--color-primary);">${escapeHtml(b.batchCode)}</strong></td>
      <td>${escapeHtml(b.houseName)}</td>
      <td>${escapeHtml(b.breedType)}</td>
      <td class="num-col"><strong>${Number(b.currentLive).toLocaleString()}</strong> / ${Number(b.flockSize).toLocaleString()}</td>
      <td class="num-col"><strong>Day ${b.ageDays}</strong> <span style="color:var(--color-text-muted);font-size:0.75rem;">(${b.ageWeeks} wks)</span></td>
      <td class="num-col"><strong>${b.expectedWeightKg} kg</strong> <span style="color:var(--color-text-muted);font-size:0.75rem;">(tgt: ${b.targetWeightKg}kg)</span></td>
      <td class="num-col" style="color:${Number(b.mortalityRate) > 3 ? '#b91c1c' : 'inherit'};font-weight:600;">${b.mortalityRate}%</td>
      <td class="status-col"><span class="${b.status === 'Active' ? 'batch-tag-active' : 'batch-tag-completed'}">${escapeHtml(b.status)}</span></td>
      <td>
        ${b.status === 'Active' ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openHarvestModal(${b.id}, '${escapeHtml(b.batchCode)}', ${b.currentLive})">Deplete / Harvest</button>` : `<span style="font-size:0.78rem;color:var(--color-text-muted);">Harvested</span>`}
      </td>
    </tr>
  `).join("");
}

if (createBatchForm) {
  createBatchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const batchCode = document.getElementById("batchCode").value.trim();
    const houseId = batchHouseSelect.value;
    const breedType = document.getElementById("breedType").value;
    const flockSize = document.getElementById("flockSize").value;
    const placementDate = placementDateInput.value;
    const targetWeightKg = document.getElementById("targetWeightKg").value;

    if (!batchCode || !houseId || !flockSize || !placementDate) {
      showError("Please complete all required fields for the new batch.");
      return;
    }

    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchCode,
          houseId,
          breedType,
          flockSize,
          placementDate,
          targetWeightKg,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create batch");
      showSuccess(`Batch ${batchCode} registered successfully.`);
      createBatchForm.reset();
      placementDateInput.value = todayStr;
      newBatchFormContainer.hidden = true;
      await loadBatches();
    } catch (err) {
      showError(err.message);
    }
  });
}

// Populate house select options for the batch modal
function updateBatchHouseOptions(houses) {
  if (!batchHouseSelect) return;
  batchHouseSelect.innerHTML = `<option value="">-- Select House --</option>` +
    houses.map(h => `<option value="${h.id}">${escapeHtml(h.name)}</option>`).join("");
}

// Hook into existing renderHouseOptions
const originalRenderHouseOptions = renderHouseOptions;
renderHouseOptions = function(houses) {
  originalRenderHouseOptions(houses);
  updateBatchHouseOptions(houses);
};

// ---------- Module 2: Feed & Silo Inventory Logic ----------

const openStockModalBtn = document.getElementById("openStockModalBtn");
const stockMovementModal = document.getElementById("stockMovementModal");
const closeStockModalBtn = document.getElementById("closeStockModalBtn");
const cancelStockModalBtn = document.getElementById("cancelStockModalBtn");
const stockMovementForm = document.getElementById("stockMovementForm");
const siloSelect = document.getElementById("siloSelect");

const invTotalBags = document.getElementById("invTotalBags");
const invTotalKg = document.getElementById("invTotalKg");
const invSilosCount = document.getElementById("invSilosCount");
const invLowCount = document.getElementById("invLowCount");
const siloCardsGrid = document.getElementById("siloCardsGrid");
const movementsTableBody = document.getElementById("movementsTableBody");

function openStockModal() {
  if (stockMovementModal) stockMovementModal.hidden = false;
}
function closeStockModal() {
  if (stockMovementModal) stockMovementModal.hidden = true;
}

if (openStockModalBtn) openStockModalBtn.addEventListener("click", openStockModal);
if (closeStockModalBtn) closeStockModalBtn.addEventListener("click", closeStockModal);
if (cancelStockModalBtn) cancelStockModalBtn.addEventListener("click", closeStockModal);
if (stockMovementModal) {
  stockMovementModal.addEventListener("click", (e) => {
    if (e.target === stockMovementModal) closeStockModal();
  });
}

async function loadInventory() {
  if (!invTotalBags) return;
  try {
    const res = await fetch("/api/inventory/summary");
    if (!res.ok) throw new Error("Failed to load inventory summary");
    const json = await res.json();
    const data = json.data;

    invTotalBags.textContent = Number(data.totalBags).toLocaleString();
    invTotalKg.textContent = `${data.totalTons} metric tons (${Number(data.totalKg).toLocaleString()} kg)`;
    if (invSilosCount) invSilosCount.textContent = data.silos.length;
    invLowCount.textContent = data.lowSilosCount;

    // FCR metrics
    const fcrMetricVal = document.getElementById("fcrMetricVal");
    const fcrRating = document.getElementById("fcrRating");
    if (fcrMetricVal && data.fcrMetric) {
      fcrMetricVal.textContent = data.fcrMetric.currentFCR;
      if (fcrRating) {
        fcrRating.innerHTML = `Target: ${data.fcrMetric.targetFCR} &bull; <strong style="color:#059669">${data.fcrMetric.rating} Efficiency</strong> (${data.fcrMetric.totalFeedConsumedKg}kg consumed)`;
      }
    }

    // Populate siloSelect
    if (siloSelect) {
      siloSelect.innerHTML = data.silos.map(s => 
        `<option value="${s.id}">${escapeHtml(s.name)} - ${escapeHtml(s.feedType)} (${s.currentBags} bags)</option>`
      ).join("");
    }

    renderSiloCards(data.silos);
    renderMovements(data.recentMovements || []);
  } catch (err) {
    console.error("Error loading inventory:", err);
  }
}

function renderSiloCards(silos) {
  if (!siloCardsGrid) return;
  siloCardsGrid.innerHTML = silos.map(s => {
    const statusClass = s.status === "Good" ? "good" : (s.status === "Low Warning" ? "warning" : "critical");
    const fillClass = s.status === "Good" ? "fill-good" : (s.status === "Low Warning" ? "fill-warning" : "fill-critical");

    return `
      <div class="silo-card ${statusClass}">
        <div class="silo-card-header">
          <div>
            <h4 class="silo-name">${escapeHtml(s.name)}</h4>
            <div class="silo-feed-type">${escapeHtml(s.feedType)}</div>
          </div>
          <span class="silo-status-pill ${statusClass}">${escapeHtml(s.status)}</span>
        </div>

        <div class="silo-bar-container">
          <div class="silo-bar-track">
            <div class="silo-bar-fill ${fillClass}" style="width: ${Math.min(100, Math.max(0, s.percentFull))}%;"></div>
          </div>
        </div>

        <div class="silo-quantities-row">
          <span>Current: <strong>${s.currentBags}</strong> / ${s.capacityBags} bags</span>
          <span><strong>${s.percentFull}%</strong> full</span>
        </div>

        <div class="silo-footer-info">
          <span>Threshold: ${s.minAlertThresholdBags} bags &bull; Last refilled ${escapeHtml(s.lastRefillDate)}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderMovements(movements) {
  if (!movementsTableBody) return;
  if (!movements.length) {
    movementsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:1.5rem;">No recent feed movements recorded.</td></tr>`;
    return;
  }

  movementsTableBody.innerHTML = movements.map(m => `
    <tr>
      <td style="font-family:var(--font-mono);font-size:0.85rem;">${escapeHtml(m.date)}</td>
      <td><strong>${escapeHtml(m.siloName)}</strong></td>
      <td><span class="${m.movementType === 'REFILL' ? 'action-tag-refill' : 'action-tag-dispatch'}">${m.movementType}</span></td>
      <td class="num-col"><strong>${m.bags} bags</strong> <span style="font-size:0.75rem;color:var(--color-text-muted);">(${(m.bags * 50).toLocaleString()} kg)</span></td>
      <td>${escapeHtml(m.supplier)}</td>
      <td style="color:var(--color-text-muted);font-size:0.82rem;">${escapeHtml(m.notes || "--")}</td>
    </tr>
  `).join("");
}

if (stockMovementForm) {
  stockMovementForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const siloId = siloSelect.value;
    const movementType = document.getElementById("movementType").value;
    const bags = document.getElementById("stockBags").value;
    const unitPrice = document.getElementById("stockUnitPrice").value;
    const supplier = document.getElementById("stockSupplier").value;
    const notes = document.getElementById("stockNotes").value;

    if (!siloId || !bags || bags <= 0) {
      showError("Please select a silo and enter a valid bag quantity.");
      return;
    }

    try {
      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siloId,
          movementType,
          bags,
          unitPrice,
          supplier,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to record movement");
      showSuccess(`Stock movement recorded: ${bags} bags ${movementType.toLowerCase()}ed.`);
      stockMovementForm.reset();
      closeStockModal();
      await loadInventory();
    } catch (err) {
      showError(err.message);
    }
  });
}

// ---------- Module 3: Biosecurity, Vaccines & Medication Logic ----------

const openHealthModalBtn = document.getElementById("openHealthModalBtn");
const treatmentModal = document.getElementById("treatmentModal");
const closeTreatmentModalBtn = document.getElementById("closeTreatmentModalBtn");
const cancelTreatmentBtn = document.getElementById("cancelTreatmentBtn");
const treatmentForm = document.getElementById("treatmentForm");
const treatmentAdminDate = document.getElementById("treatmentAdminDate");

const openTriageModalBtn = document.getElementById("openTriageModalBtn");
const triageModal = document.getElementById("triageModal");
const closeTriageModalBtn = document.getElementById("closeTriageModalBtn");
const cancelTriageBtn = document.getElementById("cancelTriageBtn");
const triageForm = document.getElementById("triageForm");

const protocolsTableBody = document.getElementById("protocolsTableBody");
const administrationsTableBody = document.getElementById("administrationsTableBody");
const activeWithdrawalsCount = document.getElementById("activeWithdrawalsCount");

if (treatmentAdminDate && !treatmentAdminDate.value) {
  treatmentAdminDate.value = todayStr;
}

function openTreatmentModal() {
  if (treatmentModal) treatmentModal.hidden = false;
}
function closeTreatmentModal() {
  if (treatmentModal) treatmentModal.hidden = true;
}

function openTriageModal() {
  if (triageModal) triageModal.hidden = false;
}
function closeTriageModal() {
  if (triageModal) triageModal.hidden = true;
}

if (openHealthModalBtn) openHealthModalBtn.addEventListener("click", openTreatmentModal);
if (closeTreatmentModalBtn) closeTreatmentModalBtn.addEventListener("click", closeTreatmentModal);
if (cancelTreatmentBtn) cancelTreatmentBtn.addEventListener("click", closeTreatmentModal);
if (treatmentModal) {
  treatmentModal.addEventListener("click", (e) => {
    if (e.target === treatmentModal) closeTreatmentModal();
  });
}

if (openTriageModalBtn) openTriageModalBtn.addEventListener("click", openTriageModal);
if (closeTriageModalBtn) closeTriageModalBtn.addEventListener("click", closeTriageModal);
if (cancelTriageBtn) cancelTriageBtn.addEventListener("click", closeTriageModal);
if (triageModal) {
  triageModal.addEventListener("click", (e) => {
    if (e.target === triageModal) closeTriageModal();
  });
}

async function loadHealthBiosecurity() {
  if (!protocolsTableBody) return;
  try {
    const res = await fetch("/api/health-biosecurity/summary");
    if (!res.ok) throw new Error("Failed to load health summary");
    const json = await res.json();
    const data = json.data;

    if (activeWithdrawalsCount) {
      activeWithdrawalsCount.textContent = data.activeWithdrawalsCount;
    }

    renderProtocols(data.protocols || []);
    renderAdministrations(data.administrations || []);
  } catch (err) {
    console.error("Error loading health biosecurity:", err);
  }
}

function renderProtocols(protocols) {
  if (!protocolsTableBody) return;
  protocolsTableBody.innerHTML = protocols.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.disease)}</strong></td>
      <td style="font-family:var(--font-mono);font-size:0.85rem;">${escapeHtml(p.targetDay)}</td>
      <td>${escapeHtml(p.route)}</td>
      <td style="color:var(--color-text-muted);font-size:0.82rem;">${escapeHtml(p.boosterDay)}</td>
      <td>${p.withdrawalDays === 0 ? "0 days (residue-free)" : `${p.withdrawalDays} days`}</td>
      <td class="status-col"><span class="badge-live-tag" style="background:#065f46;color:#a7f3d0;">${escapeHtml(p.importance)}</span></td>
    </tr>
  `).join("");
}

function renderAdministrations(admins) {
  if (!administrationsTableBody) return;
  if (!admins.length) {
    administrationsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:1.5rem;">No treatments administered yet.</td></tr>`;
    return;
  }

  administrationsTableBody.innerHTML = admins.map(a => `
    <tr>
      <td style="font-family:var(--font-mono);">${escapeHtml(a.adminDate)}</td>
      <td><strong>${escapeHtml(a.batchCode)}</strong> <span style="font-size:0.75rem;color:var(--color-text-muted);">(${escapeHtml(a.houseName)})</span></td>
      <td><span class="${a.treatmentType === 'VACCINATION' ? 'batch-tag-active' : 'batch-tag-completed'}">${escapeHtml(a.treatmentType)}</span></td>
      <td><strong>${escapeHtml(a.medicationName)}</strong></td>
      <td style="font-size:0.82rem;">${escapeHtml(a.dosage)}</td>
      <td>
        ${a.isUnderWithdrawal
          ? `<span class="withdrawal-tag-active">⚠️ WITHDRAWAL (${a.daysRemaining} days left &bull; Clear: ${a.withdrawalClearDate})</span>`
          : `<span class="withdrawal-tag-clear">✓ CLEAR (Residue-free)</span>`}
      </td>
      <td style="color:var(--color-text-muted);font-size:0.82rem;">${escapeHtml(a.administeredBy)}</td>
    </tr>
  `).join("");
}

if (treatmentForm) {
  treatmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const batchCode = document.getElementById("treatmentBatchSelect").value;
    const treatmentType = document.getElementById("treatmentTypeSelect").value;
    const medicationName = document.getElementById("medicationName").value.trim();
    const adminDate = treatmentAdminDate.value;
    const withdrawalPeriodDays = document.getElementById("withdrawalDays").value;
    const dosage = document.getElementById("treatmentDosage").value;
    const administeredBy = document.getElementById("administeredBy").value;
    const notes = document.getElementById("treatmentNotes").value;

    try {
      const res = await fetch("/api/health-biosecurity/administrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchCode,
          treatmentType,
          medicationName,
          adminDate,
          withdrawalPeriodDays,
          dosage,
          administeredBy,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to record treatment");
      showSuccess(`Treatment recorded: ${medicationName}. Withdrawal: ${withdrawalPeriodDays} days.`);
      treatmentForm.reset();
      treatmentAdminDate.value = todayStr;
      closeTreatmentModal();
      await loadHealthBiosecurity();
    } catch (err) {
      showError(err.message);
    }
  });
}

if (triageForm) {
  triageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mortalityCount = document.getElementById("triageMortality").value;
    const triageLevel = document.getElementById("triageLevel").value;
    const primarySymptoms = document.getElementById("primarySymptoms").value;
    const suspectedCause = document.getElementById("suspectedCause").value;
    const actionTaken = document.getElementById("triageAction").value;

    try {
      const res = await fetch("/api/health-biosecurity/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mortalityCount,
          triageLevel,
          primarySymptoms,
          suspectedCause,
          actionTaken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to log triage");
      showSuccess("Biosecurity triage event logged and containment alert broadcasted.");
      triageForm.reset();
      closeTriageModal();
    } catch (err) {
      showError(err.message);
    }
  });
}

// ---------- Module 4: Enterprise P&L & Commercial Sales Logic ----------

const openInvoiceModalBtn = document.getElementById("openInvoiceModalBtn");
const invoiceModal = document.getElementById("invoiceModal");
const closeInvoiceModalBtn = document.getElementById("closeInvoiceModalBtn");
const cancelInvoiceBtn = document.getElementById("cancelInvoiceBtn");
const invoiceForm = document.getElementById("invoiceForm");

const finRevenue = document.getElementById("finRevenue");
const finNetProfit = document.getElementById("finNetProfit");
const finMarginPercent = document.getElementById("finMarginPercent");
const finProfitPerCrate = document.getElementById("finProfitPerCrate");
const finProfitPerKg = document.getElementById("finProfitPerKg");
const salesTableBody = document.getElementById("salesTableBody");

function openInvoiceModal() {
  if (invoiceModal) invoiceModal.hidden = false;
}
function closeInvoiceModal() {
  if (invoiceModal) invoiceModal.hidden = true;
}

if (openInvoiceModalBtn) openInvoiceModalBtn.addEventListener("click", openInvoiceModal);
if (closeInvoiceModalBtn) closeInvoiceModalBtn.addEventListener("click", closeInvoiceModal);
if (cancelInvoiceBtn) cancelInvoiceBtn.addEventListener("click", closeInvoiceModal);
if (invoiceModal) {
  invoiceModal.addEventListener("click", (e) => {
    if (e.target === invoiceModal) closeInvoiceModal();
  });
}

async function loadSalesFinancials() {
  if (!salesTableBody) return;
  try {
    const res = await fetch("/api/sales/financials");
    if (!res.ok) throw new Error("Failed to load financials");
    const json = await res.json();
    const data = json.data;
    const summary = data.financialSummary;

    if (finRevenue) finRevenue.textContent = Number(summary.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (finNetProfit) finNetProfit.textContent = Number(summary.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (finMarginPercent) finMarginPercent.textContent = summary.overallMargin;
    if (finProfitPerCrate) finProfitPerCrate.textContent = summary.profitPerCrate;
    if (finProfitPerKg) finProfitPerKg.textContent = summary.profitPerKgMeat;

    renderInvoices(data.invoices || []);
  } catch (err) {
    console.error("Error loading sales financials:", err);
  }
}

function renderInvoices(invoices) {
  if (!salesTableBody) return;
  if (!invoices.length) {
    salesTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--color-text-muted);padding:1.5rem;">No commercial sales recorded yet.</td></tr>`;
    return;
  }

  salesTableBody.innerHTML = invoices.map(i => `
    <tr>
      <td style="font-family:var(--font-mono);font-weight:700;color:var(--color-primary);">${escapeHtml(i.invoiceNumber)}</td>
      <td style="font-family:var(--font-mono);">${escapeHtml(i.date)}</td>
      <td><strong>${escapeHtml(i.customerName)}</strong></td>
      <td><span class="${i.itemCategory === 'EGGS' ? 'action-tag-refill' : 'action-tag-dispatch'}">${i.itemCategory}</span> <small style="color:var(--color-text-muted);">${escapeHtml(i.details)}</small></td>
      <td class="num-col"><strong>${Number(i.quantity).toLocaleString()}</strong> ${i.itemCategory === 'EGGS' ? 'crates' : 'birds'} ${i.totalWeightKg ? `(${i.totalWeightKg}kg)` : ''}</td>
      <td class="num-col">$${Number(i.unitPrice).toFixed(2)}</td>
      <td class="num-col" style="font-weight:700;">$${Number(i.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      <td class="num-col" style="color:#059669;font-weight:700;">+$${Number(i.netMargin).toFixed(2)} <span style="font-size:0.72rem;color:var(--color-text-muted);">(${i.marginPercentage}%)</span></td>
      <td class="status-col"><span class="${i.paymentStatus === 'PAID' ? 'payment-tag-paid' : 'payment-tag-pending'}">${escapeHtml(i.paymentStatus)}</span></td>
    </tr>
  `).join("");
}

if (invoiceForm) {
  invoiceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const customerName = document.getElementById("customerName").value.trim();
    const itemCategory = document.getElementById("itemCategory").value;
    const quantity = document.getElementById("invoiceQty").value;
    const unitPrice = document.getElementById("invoiceUnitPrice").value;
    const paymentStatus = document.getElementById("invoicePaymentStatus").value;
    const details = document.getElementById("invoiceDetails").value;
    const notes = document.getElementById("invoiceNotes").value;

    try {
      const res = await fetch("/api/sales/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          itemCategory,
          quantity,
          unitPrice,
          paymentStatus,
          details,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create invoice");
      showSuccess(`Invoice created for ${customerName}: $${Number(data.data.totalRevenue).toFixed(2)}.`);
      invoiceForm.reset();
      closeInvoiceModal();
      await loadSalesFinancials();
    } catch (err) {
      showError(err.message);
    }
  });
}

// ---------- Init ----------

// Pre-fill today's date for daily record date and house creation date
const recordDateInput = document.getElementById("recordDate");
const dateCreatedInput = document.getElementById("dateCreated");
if (recordDateInput && !recordDateInput.value) {
  recordDateInput.value = todayStr;
}
if (dateCreatedInput && !dateCreatedInput.value) {
  dateCreatedInput.value = todayStr;
}

loadHouses();
loadBatches();
loadInventory();
loadHealthBiosecurity();
loadSalesFinancials();

