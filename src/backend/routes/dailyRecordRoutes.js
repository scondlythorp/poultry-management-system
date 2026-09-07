const express = require("express");
const {
  createDailyRecord,
  getDailyRecords,
} = require("../controllers/dailyRecordController");

// Merge params from parent route (house ID) into this router.
const router = express.Router({ mergeParams: true });

// POST   /api/houses/:id/daily-records
// GET    /api/houses/:id/daily-records
router.post("/", createDailyRecord);
router.get("/", getDailyRecords);


module.exports = router;
