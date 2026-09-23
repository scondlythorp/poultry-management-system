// src/backend/controllers/batchController.js
const prisma = require("../prisma/client");

// Standard target growth curves by age (days)
const BREED_CURVES = {
  "Cobb 500 (Commercial Broiler)": {
    type: "broiler",
    standardHarvestDays: 42,
    weights: { 7: 0.19, 14: 0.48, 21: 0.95, 28: 1.55, 35: 2.25, 42: 2.85 }
  },
  "Ross 308 (Fast Growing Broiler)": {
    type: "broiler",
    standardHarvestDays: 38,
    weights: { 7: 0.20, 14: 0.50, 21: 1.00, 28: 1.62, 35: 2.30, 42: 2.95 }
  },
  "Isa Brown (Commercial Layer)": {
    type: "layer",
    standardHarvestDays: 504, // 72 weeks
    peakProductionWeek: 26,
    weights: { 7: 0.08, 14: 0.16, 28: 0.42, 56: 0.95, 112: 1.55, 140: 1.85 }
  },
  "Lohmann Brown (Layer)": {
    type: "layer",
    standardHarvestDays: 504,
    peakProductionWeek: 27,
    weights: { 7: 0.08, 14: 0.16, 28: 0.40, 56: 0.92, 112: 1.52, 140: 1.82 }
  },
  "Sasso / Kuroiler (Dual Purpose)": {
    type: "dual",
    standardHarvestDays: 70,
    weights: { 7: 0.12, 14: 0.28, 28: 0.75, 42: 1.35, 56: 1.95, 70: 2.60 }
  }
};

function getExpectedWeight(breedName, ageDays) {
  const curve = BREED_CURVES[breedName] || BREED_CURVES["Cobb 500 (Commercial Broiler)"];
  const days = Object.keys(curve.weights).map(Number).sort((a, b) => a - b);
  
  if (ageDays <= days[0]) return curve.weights[days[0]];
  if (ageDays >= days[days.length - 1]) return curve.weights[days[days.length - 1]];

  for (let i = 0; i < days.length - 1; i++) {
    const d1 = days[i];
    const d2 = days[i + 1];
    if (ageDays >= d1 && ageDays <= d2) {
      const w1 = curve.weights[d1];
      const w2 = curve.weights[d2];
      const ratio = (ageDays - d1) / (d2 - d1);
      return Number((w1 + ratio * (w2 - w1)).toFixed(2));
    }
  }
  return 1.8;
}

// In-memory store for batches
let batchesStore = [
  {
    id: 1,
    batchCode: "BATCH-2026-01",
    houseId: 1,
    houseName: "House A",
    breedType: "Cobb 500 (Commercial Broiler)",
    purpose: "Meat / Broiler",
    flockSize: 500,
    currentLive: 495,
    placementDate: "2026-09-01",
    targetHarvestDate: "2026-10-15",
    targetWeightKg: 2.4,
    mortalityCount: 5,
    harvestedBirds: 0,
    harvestedWeightKg: 0,
    status: "Active",
    notes: "Initial commercial placement batch",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
  },
  {
    id: 2,
    batchCode: "LAYER-2026-L1",
    houseId: 1,
    houseName: "House A",
    breedType: "Isa Brown (Commercial Layer)",
    purpose: "Egg Production (72-Week Cycle)",
    flockSize: 450,
    currentLive: 442,
    placementDate: "2026-06-15",
    targetHarvestDate: "2027-11-20",
    targetWeightKg: 1.9,
    mortalityCount: 8,
    harvestedBirds: 0,
    harvestedWeightKg: 0,
    status: "Active",
    notes: "High laying curve performance flock",
    createdAt: new Date("2026-06-15T00:00:00.000Z"),
  }
];
let nextBatchId = 3;

async function getBatches(req, res, next) {
  try {
    const houseId = req.query.houseId ? Number(req.query.houseId) : null;
    let list = [...batchesStore];
    if (houseId) {
      list = list.filter(b => b.houseId === houseId);
    }
    const now = new Date();
    const enriched = list.map(b => {
      const placement = new Date(b.placementDate);
      const diffTime = Math.max(0, now - placement);
      const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const ageWeeks = (ageDays / 7).toFixed(1);
      const expectedWeightKg = getExpectedWeight(b.breedType, ageDays);
      const mortalityRate = b.flockSize > 0 
        ? (((b.mortalityCount || (b.flockSize - b.currentLive)) / b.flockSize) * 100).toFixed(1)
        : "0.0";

      return {
        ...b,
        ageDays,
        ageWeeks,
        expectedWeightKg,
        mortalityRate,
      };
    });

    res.status(200).json({ success: true, data: enriched, breedProfiles: BREED_CURVES });
  } catch (err) {
    next(err);
  }
}

async function createBatch(req, res, next) {
  try {
    const {
      batchCode,
      houseId,
      breedType,
      purpose,
      flockSize,
      placementDate,
      targetHarvestDate,
      targetWeightKg,
      notes,
    } = req.body;

    if (!batchCode || !houseId || !breedType || !flockSize || !placementDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: batchCode, houseId, breedType, flockSize, and placementDate are mandatory."
      });
    }

    const house = await prisma.poultryHouse.findUnique({ where: { id: Number(houseId) } });
    const houseName = house ? house.name : `House #${houseId}`;

    const newBatch = {
      id: nextBatchId++,
      batchCode: String(batchCode).trim(),
      houseId: Number(houseId),
      houseName,
      breedType: String(breedType).trim(),
      purpose: purpose || (breedType.includes("Layer") ? "Egg Production (72-Week Cycle)" : "Meat / Broiler"),
      flockSize: Number(flockSize),
      currentLive: Number(flockSize),
      placementDate: String(placementDate),
      targetHarvestDate: targetHarvestDate || null,
      targetWeightKg: targetWeightKg ? Number(targetWeightKg) : (breedType.includes("Layer") ? 1.9 : 2.5),
      mortalityCount: 0,
      harvestedBirds: 0,
      harvestedWeightKg: 0,
      status: "Active",
      notes: notes || "",
      createdAt: new Date(),
    };

    batchesStore.unshift(newBatch);
    res.status(201).json({ success: true, data: newBatch });
  } catch (err) {
    next(err);
  }
}

async function recordBatchHarvest(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { harvestedBirds, harvestedWeightKg, notes } = req.body;
    const batch = batchesStore.find(b => b.id === id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    const count = Number(harvestedBirds);
    const weight = Number(harvestedWeightKg);
    if (!count || count <= 0) {
      return res.status(400).json({ success: false, message: "Valid harvested birds count required" });
    }

    batch.harvestedBirds = (batch.harvestedBirds || 0) + count;
    batch.harvestedWeightKg = (batch.harvestedWeightKg || 0) + (weight || 0);
    batch.currentLive = Math.max(0, batch.currentLive - count);
    if (batch.currentLive === 0) {
      batch.status = "Harvested / Completed";
    }
    if (notes) {
      batch.notes = (batch.notes ? batch.notes + " | " : "") + `Depletion: ${count} birds (${weight}kg)`;
    }

    res.status(200).json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

async function updateBatchStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const batch = batchesStore.find(b => b.id === id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    batch.status = status || "Completed";
    res.status(200).json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBatches,
  createBatch,
  recordBatchHarvest,
  updateBatchStatus,
  BREED_CURVES,
};
