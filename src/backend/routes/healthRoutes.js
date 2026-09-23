// src/backend/routes/healthRoutes.js
const express = require("express");
const {
  getHealthSummary,
  recordAdministration,
  recordTriageLog,
} = require("../controllers/healthController");

const router = express.Router();

router.get("/summary", getHealthSummary);
router.post("/administrations", recordAdministration);
router.post("/triage", recordTriageLog);

module.exports = router;
