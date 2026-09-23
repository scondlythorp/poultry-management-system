// src/backend/routes/inventoryRoutes.js
const express = require("express");
const { getInventorySummary, addSilo, recordStockMovement } = require("../controllers/inventoryController");

const router = express.Router();

router.get("/summary", getInventorySummary);
router.post("/silos", addSilo);
router.post("/movements", recordStockMovement);

module.exports = router;
