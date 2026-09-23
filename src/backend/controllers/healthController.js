// src/backend/controllers/healthController.js

// Standard Commercial Poultry Vaccination Protocols
const VACCINE_PROTOCOLS = [
  {
    disease: "Marek's Disease (HVT)",
    targetDay: "Day 1 (Hatchery)",
    route: "Subcutaneous Injection",
    boosterDay: "None (Single)",
    withdrawalDays: 0,
    importance: "Crucial / Mandatory",
  },
  {
    disease: "Newcastle Disease (ND) + Infectious Bronchitis (IB)",
    targetDay: "Day 7",
    route: "Ocular Eye Drop / Spray",
    boosterDay: "Day 21 (ND LaSota via Drinking Water)",
    withdrawalDays: 0,
    importance: "High Priority",
  },
  {
    disease: "Infectious Bursal Disease (Gumboro - IBD)",
    targetDay: "Day 10",
    route: "Oral Drinking Water (Skimmed milk stabilizer)",
    boosterDay: "Day 18 (Intermediate Plus Strain)",
    withdrawalDays: 0,
    importance: "Crucial / High Risk",
  },
  {
    disease: "Fowl Pox (Wing Web)",
    targetDay: "Week 6 - 8 (Layers / Breeders)",
    route: "Wing Web Prick",
    boosterDay: "Prior to Point of Lay",
    withdrawalDays: 0,
    importance: "Layer Essential",
  },
  {
    disease: "Avian Encephalomyelitis (AE) + Egg Drop Syndrome (EDS)",
    targetDay: "Week 12 - 14 (Layers)",
    route: "Intramuscular Breast Injection",
    boosterDay: "Pre-lay booster",
    withdrawalDays: 0,
    importance: "Layer Quality",
  }
];

// In-memory store for health administrations
let administrationsStore = [
  {
    id: 1,
    batchCode: "BATCH-2026-01",
    houseId: 1,
    houseName: "House A",
    treatmentType: "VACCINATION",
    medicationName: "Gumboro (IBD Intermediate)",
    adminDate: "2026-09-10",
    administeredBy: "Chief Vet Dr. Osei",
    withdrawalPeriodDays: 0,
    withdrawalClearDate: "2026-09-10",
    dosage: "500 doses in 10L stabilizer water",
    status: "Completed",
    notes: "Flock showed strong water uptake within 90 minutes",
  },
  {
    id: 2,
    batchCode: "BATCH-2026-01",
    houseId: 1,
    houseName: "House A",
    treatmentType: "MEDICATION",
    medicationName: "Oxytetracycline 20% Soluble",
    adminDate: "2026-09-19",
    administeredBy: "Flock Supervisor",
    withdrawalPeriodDays: 7,
    withdrawalClearDate: "2026-09-26",
    dosage: "1g per 2 Liters drinking water for 3 days",
    status: "Active Withdrawal",
    notes: "Respiratory checkup. Meat harvest strictly prohibited until Sept 26.",
  }
];
let nextAdminId = 3;

// In-memory store for mortality symptoms triage logs
let symptomsTriageLogs = [
  {
    id: 1,
    date: "2026-09-20",
    houseId: 1,
    houseName: "House A",
    mortalityCount: 2,
    primarySymptoms: ["Ruffled feathers", "Mild watery droppings"],
    suspectedCause: "Post-vaccination stress or mild coccidial load",
    actionTaken: "Administered electrolyte and probiotic mix into drinkers",
    triageLevel: "Low / Normal",
    notes: "Flock appetite and activity normal",
  }
];
let nextTriageId = 2;

async function getHealthSummary(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // Enrich administrations with live withdrawal countdown
    const enrichedAdmins = administrationsStore.map(a => {
      let isUnderWithdrawal = false;
      let daysRemaining = 0;
      if (a.withdrawalClearDate && a.withdrawalClearDate >= today) {
        isUnderWithdrawal = true;
        const diff = new Date(a.withdrawalClearDate) - new Date(today);
        daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }
      return {
        ...a,
        isUnderWithdrawal,
        daysRemaining,
      };
    });

    const activeWithdrawals = enrichedAdmins.filter(a => a.isUnderWithdrawal).length;

    res.status(200).json({
      success: true,
      data: {
        activeWithdrawalsCount: activeWithdrawals,
        protocols: VACCINE_PROTOCOLS,
        administrations: enrichedAdmins.reverse(),
        triageLogs: symptomsTriageLogs.slice(-10).reverse(),
      }
    });
  } catch (err) {
    next(err);
  }
}

async function recordAdministration(req, res, next) {
  try {
    const {
      batchCode,
      houseId,
      treatmentType,
      medicationName,
      adminDate,
      administeredBy,
      withdrawalPeriodDays,
      dosage,
      notes,
    } = req.body;

    if (!treatmentType || !medicationName || !adminDate) {
      return res.status(400).json({
        success: false,
        message: "Treatment type, medication/vaccine name, and admin date are required."
      });
    }

    const wDays = Number(withdrawalPeriodDays || 0);
    const aDate = new Date(adminDate);
    const clearDate = new Date(aDate);
    clearDate.setDate(clearDate.getDate() + wDays);
    const withdrawalClearDate = clearDate.toISOString().slice(0, 10);

    const newAdmin = {
      id: nextAdminId++,
      batchCode: batchCode || "BATCH-2026-01",
      houseId: Number(houseId || 1),
      houseName: houseId ? `House #${houseId}` : "House A",
      treatmentType: String(treatmentType).toUpperCase(),
      medicationName: String(medicationName).trim(),
      adminDate: String(adminDate),
      administeredBy: administeredBy || "Staff Veterinarian",
      withdrawalPeriodDays: wDays,
      withdrawalClearDate,
      dosage: dosage || "Per manufacturer spec",
      status: wDays > 0 ? "Active Withdrawal" : "Completed",
      notes: notes || "",
    };

    administrationsStore.push(newAdmin);
    res.status(201).json({ success: true, data: newAdmin });
  } catch (err) {
    next(err);
  }
}

async function recordTriageLog(req, res, next) {
  try {
    const { houseId, mortalityCount, primarySymptoms, suspectedCause, actionTaken, triageLevel, notes } = req.body;

    const newTriage = {
      id: nextTriageId++,
      date: new Date().toISOString().slice(0, 10),
      houseId: Number(houseId || 1),
      houseName: houseId ? `House #${houseId}` : "House A",
      mortalityCount: Number(mortalityCount || 1),
      primarySymptoms: Array.isArray(primarySymptoms) ? primarySymptoms : [primarySymptoms || "Observation recorded"],
      suspectedCause: suspectedCause || "Under observation",
      actionTaken: actionTaken || "Flock isolated and monitored",
      triageLevel: triageLevel || "Moderate Warning",
      notes: notes || "",
    };

    symptomsTriageLogs.push(newTriage);
    res.status(201).json({ success: true, data: newTriage });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHealthSummary,
  recordAdministration,
  recordTriageLog,
  VACCINE_PROTOCOLS,
};
