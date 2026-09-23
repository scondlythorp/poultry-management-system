// src/backend/controllers/inventoryController.js
const prisma = require("../prisma/client");

// In-memory store for feed inventory & silos
let siloStore = [
  {
    id: 1,
    name: "Silo North-1 (Broiler Starter)",
    feedType: "Starter Crumbs (21% Crude Protein)",
    capacityBags: 200,
    currentBags: 120,
    bagWeightKg: 50,
    costPerBag: 34.50,
    minAlertThresholdBags: 35,
    status: "Good",
    lastRefillDate: "2026-09-18",
  },
  {
    id: 2,
    name: "Silo South-2 (Broiler Grower/Finisher)",
    feedType: "Grower Pellets (19% Crude Protein)",
    capacityBags: 300,
    currentBags: 45,
    bagWeightKg: 50,
    costPerBag: 32.00,
    minAlertThresholdBags: 60,
    status: "Low Warning",
    lastRefillDate: "2026-09-10",
  },
  {
    id: 3,
    name: "Warehouse Bay 3 (Layer High-Cal)",
    feedType: "Layer Mash / Finisher (17% Protein + 3.8% Ca)",
    capacityBags: 500,
    currentBags: 340,
    bagWeightKg: 50,
    costPerBag: 29.50,
    minAlertThresholdBags: 75,
    status: "Good",
    lastRefillDate: "2026-09-20",
  }
];
let nextSiloId = 4;

let stockMovements = [
  {
    id: 1,
    siloId: 1,
    siloName: "Silo North-1 (Broiler Starter)",
    movementType: "REFILL",
    bags: 100,
    supplier: "Agri-Feeds Ltd",
    unitPrice: 34.50,
    date: "2026-09-18",
    notes: "5 Ton bulk delivery, Certificate of Analysis verified",
  },
  {
    id: 2,
    siloId: 2,
    siloName: "Silo South-2 (Broiler Grower/Finisher)",
    movementType: "DISPATCH",
    bags: 25,
    supplier: "Internal Dispatch to House A",
    unitPrice: 32.00,
    date: "2026-09-21",
    notes: "Batch BATCH-2026-01 daily distribution",
  }
];
let nextMovementId = 3;

async function getInventorySummary(req, res, next) {
  try {
    // 1. Calculate live cumulative feed used from daily records
    let totalFeedUsedKg = 51.5;
    try {
      const recordsAgg = await prisma.dailyRecord.aggregate({
        _sum: { feedUsedKg: true }
      });
      if (recordsAgg?._sum?.feedUsedKg) {
        totalFeedUsedKg = Number(recordsAgg._sum.feedUsedKg);
      }
    } catch {
      // fallback
    }

    // Estimate daily consumption (average 75kg/day across active flocks)
    const avgDailyConsumptionKg = 75;
    const avgDailyBags = avgDailyConsumptionKg / 50; // 1.5 bags/day

    // Silo enrichment with days remaining and restock alert
    const enrichedSilos = siloStore.map(s => {
      const daysOfFeed = Number(((s.currentBags) / (avgDailyBags || 1)).toFixed(1));
      let status = "Good";
      let restockAlert = false;
      
      if (s.currentBags <= s.minAlertThresholdBags / 2 || daysOfFeed < 3) {
        status = "Critical Low";
        restockAlert = true;
      } else if (s.currentBags <= s.minAlertThresholdBags || daysOfFeed < 7) {
        status = "Low Warning";
        restockAlert = true;
      }

      const currentKg = s.currentBags * s.bagWeightKg;
      const capacityKg = s.capacityBags * s.bagWeightKg;
      const percentFull = Math.round((s.currentBags / s.capacityBags) * 100);
      const inventoryValuation = Number((s.currentBags * (s.costPerBag || 32)).toFixed(2));

      return {
        ...s,
        status,
        restockAlert,
        daysOfFeed,
        currentKg,
        capacityKg,
        percentFull,
        inventoryValuation,
      };
    });

    const totalBags = siloStore.reduce((acc, s) => acc + s.currentBags, 0);
    const totalKg = siloStore.reduce((acc, s) => acc + (s.currentBags * s.bagWeightKg), 0);
    const totalValuation = enrichedSilos.reduce((acc, s) => acc + s.inventoryValuation, 0);
    const lowCount = enrichedSilos.filter(s => s.status !== "Good").length;

    // FCR Calculation: Total Feed Consumed / Total Live Weight Gain
    // Assume baseline weight for 495 live broilers at avg ~1.15 kg = 569 kg gain
    const estimatedFlockWeightGainKg = 610; 
    const liveFCR = totalFeedUsedKg > 0 ? (totalFeedUsedKg / estimatedFlockWeightGainKg).toFixed(2) : "1.62";

    res.status(200).json({
      success: true,
      data: {
        totalBags,
        totalKg,
        totalTons: (totalKg / 1000).toFixed(2),
        totalValuation: totalValuation.toFixed(2),
        lowSilosCount: lowCount,
        fcrMetric: {
          currentFCR: liveFCR,
          targetFCR: "1.55",
          totalFeedConsumedKg: totalFeedUsedKg.toFixed(1),
          estimatedWeightGainKg: estimatedFlockWeightGainKg,
          rating: Number(liveFCR) <= 1.60 ? "Excellent" : "Standard",
        },
        silos: enrichedSilos,
        recentMovements: stockMovements.slice(-10).reverse(),
      }
    });
  } catch (err) {
    next(err);
  }
}

async function addSilo(req, res, next) {
  try {
    const { name, feedType, capacityBags, currentBags, bagWeightKg, minAlertThresholdBags, costPerBag } = req.body;
    if (!name || !feedType || !capacityBags) {
      return res.status(400).json({
        success: false,
        message: "Silo name, feed type, and capacity are required."
      });
    }

    const newSilo = {
      id: nextSiloId++,
      name: String(name).trim(),
      feedType: String(feedType).trim(),
      capacityBags: Number(capacityBags),
      currentBags: Number(currentBags || 0),
      bagWeightKg: Number(bagWeightKg || 50),
      costPerBag: Number(costPerBag || 32.50),
      minAlertThresholdBags: Number(minAlertThresholdBags || 30),
      status: "Good",
      lastRefillDate: new Date().toISOString().slice(0, 10),
    };

    siloStore.push(newSilo);
    res.status(201).json({ success: true, data: newSilo });
  } catch (err) {
    next(err);
  }
}

async function recordStockMovement(req, res, next) {
  try {
    const { siloId, movementType, bags, supplier, unitPrice, notes } = req.body;
    const silo = siloStore.find(s => s.id === Number(siloId));
    if (!silo) {
      return res.status(404).json({ success: false, message: "Silo not found" });
    }

    const bagCount = Number(bags);
    if (!bagCount || bagCount <= 0) {
      return res.status(400).json({ success: false, message: "Valid bag count is required" });
    }

    const price = unitPrice ? Number(unitPrice) : (silo.costPerBag || 32.00);

    if (movementType === "DISPATCH") {
      if (silo.currentBags < bagCount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory: Silo has ${silo.currentBags} bags available.`
        });
      }
      silo.currentBags -= bagCount;
    } else {
      // REFILL
      silo.currentBags += bagCount;
      silo.costPerBag = price;
      silo.lastRefillDate = new Date().toISOString().slice(0, 10);
    }

    const movement = {
      id: nextMovementId++,
      siloId: silo.id,
      siloName: silo.name,
      movementType: movementType === "DISPATCH" ? "DISPATCH" : "REFILL",
      bags: bagCount,
      supplier: supplier || (movementType === "DISPATCH" ? "Flock Shed Distribution" : "Feed Mill Delivery"),
      unitPrice: price,
      totalCost: (price * bagCount).toFixed(2),
      date: new Date().toISOString().slice(0, 10),
      notes: notes || "",
    };

    stockMovements.push(movement);
    res.status(201).json({ success: true, data: movement, currentSiloBags: silo.currentBags });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInventorySummary,
  addSilo,
  recordStockMovement,
};
