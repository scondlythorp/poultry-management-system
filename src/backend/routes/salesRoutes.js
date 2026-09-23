// src/backend/routes/salesRoutes.js
const express = require("express");
const {
  getSalesFinancials,
  createInvoice,
  updatePaymentStatus,
} = require("../controllers/salesController");

const router = express.Router();

router.get("/financials", getSalesFinancials);
router.post("/invoices", createInvoice);
router.patch("/invoices/:id/payment", updatePaymentStatus);

module.exports = router;
