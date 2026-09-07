
const express = require("express");
const {
  createHouse,
  getHouses,
  getHouseById,
  getDashboard,
} = require("../controllers/houseController");
const dailyRecordRoutes = require("./dailyRecordRoutes");

const router = express.Router();

// POST   /api/houses
// GET    /api/houses
router.post("/", createHouse);
router.get("/", getHouses);

// GET    /api/houses/:id
router.get("/:id", getHouseById);

// GET    /api/houses/:id/dashboard
router.get("/:id/dashboard", getDashboard);

// Nested routes for daily records under a specific house.
router.use("/:id/daily-records", dailyRecordRoutes);

module.exports = router;
