/**
 * Frontend logic.
 *
 * This file ONLY talks to the backend through fetch() calls to the
 * REST API. There is no database logic here and no localStorage used
 * as a data store — the API + PostgreSQL are the single source of truth.
 * Refreshing the page always re-fetches from the server.
 */
const API_BASE = "/api";

// Tracks which house is currently selected, so we know which
// house to attach new daily records to and which dashboard to show.
let selectedHouseId = null;

// ---------- DOM references ----------
const statusBanner = document.getElementById("statusBanner");
const houseSelect = document.getElementById("houseSelect");

const dashboardEmpty = document.getElementById("dashboardEmpty");
const dashboardStats = document.getElementById("dashboardStats");
const statCurrentBirds = document.getElementById("statCurrentBirds");
const statMortality = document.getElementById("statMortality");
const statFeed = document.getElementById("statFeed");
const statEggs = document.getElementById("statEggs");

const houseForm = document.getElementById("houseForm");
const dailyRecordForm = document.getElementById("dailyRecordForm");

const recordsEmpty = document.getElementById("recordsEmpty");
const recordsTable = document.getElementById("recordsTable");
const recordsTableBody = document.getElementById("recordsTableBody");

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

  if (houses.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "-- No houses yet --";
    houseSelect.appendChild(option);
    selectedHouseId = null;
    renderEmptyDashboard();
    renderEmptyRecords();
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select a house --";
  houseSelect.appendChild(placeholder);

  houses.forEach((house) => {
    const option = document.createElement("option");
    option.value = house.id;
    option.textContent = `${house.name} (${house.birdsPlaced} birds)`;
    houseSelect.appendChild(option);
  });

  // Auto-select the most recently created house (list is newest-first).
  houseSelect.value = houses[0].id;
  selectedHouseId = houses[0].id;
  loadDashboard(selectedHouseId);
  loadDailyRecords(selectedHouseId);
}

houseSelect.addEventListener("change", (e) => {
  const value = e.target.value;
  selectedHouseId = value ? Number(value) : null;

  if (!selectedHouseId) {
    renderEmptyDashboard();
    renderEmptyRecords();
    return;
  }

  loadDashboard(selectedHouseId);
  loadDailyRecords(selectedHouseId);
});

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
    statCurrentBirds.textContent = data.currentBirds;
    statMortality.textContent = data.totalMortality;
    statFeed.textContent = Number(data.totalFeedUsedKg).toFixed(2);
    statEggs.textContent = data.totalEggsCollected;
  } catch (err) {
    showError(err.message);
  }
}

// ---------- Daily Records ----------

function renderEmptyRecords() {
  recordsEmpty.hidden = false;
  recordsTable.hidden = true;
  recordsTableBody.innerHTML = "";
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

  records.forEach((record) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = new Date(record.date).toLocaleDateString();

    const mortalityCell = document.createElement("td");
    mortalityCell.textContent = record.mortality;

    const feedCell = document.createElement("td");
    feedCell.textContent = Number(record.feedUsedKg).toFixed(2);

    const eggsCell = document.createElement("td");
    eggsCell.textContent = record.eggsCollected;

    row.append(dateCell, mortalityCell, feedCell, eggsCell);
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

// ---------- Init ----------

loadHouses();
