// src/backend/routes/batchRoutes.js
const express = require("express");
const { getBatches, createBatch, recordBatchHarvest, updateBatchStatus } = require("../controllers/batchController");

const router = express.Router();

router.get("/", getBatches);
router.post("/", createBatch);
router.post("/:id/harvest", recordBatchHarvest);
router.patch("/:id/status", updateBatchStatus);

module.exports = router;
