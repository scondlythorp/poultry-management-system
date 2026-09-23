// src/backend/controllers/salesController.js

// In-memory store for commercial sales & invoices
let salesInvoices = [
  {
    id: 1,
    invoiceNumber: "INV-2026-001",
    customerName: "GreenGrocers Supermarket Ltd",
    itemCategory: "EGGS",
    details: "Large Grade A (30 eggs/crate)",
    quantity: 45, // 45 crates
    unitPrice: 5.80, // $5.80 per crate
    totalRevenue: 261.00,
    productionCost: 162.00, // feed + packaging + vet
    netMargin: 99.00,
    marginPercentage: "37.9",
    date: "2026-09-19",
    paymentStatus: "PAID",
    notes: "Regular weekly crate delivery",
  },
  {
    id: 2,
    invoiceNumber: "INV-2026-002",
    customerName: "Metro Hospitality & Grill",
    itemCategory: "BROILERS",
    details: "Live Mature Broilers (Avg 2.4kg)",
    quantity: 120, // 120 birds
    totalWeightKg: 288.0, // 120 * 2.4kg
    unitPrice: 3.50, // $3.50 per kg live weight
    totalRevenue: 1008.00,
    productionCost: 695.00,
    netMargin: 313.00,
    marginPercentage: "31.1",
    date: "2026-09-22",
    paymentStatus: "PENDING",
    notes: "Batch BATCH-2026-01 partial harvest dispatch",
  }
];
let nextInvoiceId = 3;

async function getSalesFinancials(req, res, next) {
  try {
    const totalRevenue = salesInvoices.reduce((acc, inv) => acc + inv.totalRevenue, 0);
    const totalCost = salesInvoices.reduce((acc, inv) => acc + inv.productionCost, 0);
    const netProfit = totalRevenue - totalCost;
    const overallMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";

    const eggSales = salesInvoices.filter(i => i.itemCategory === "EGGS");
    const broilerSales = salesInvoices.filter(i => i.itemCategory === "BROILERS");

    const totalCratesSold = eggSales.reduce((acc, i) => acc + i.quantity, 0);
    const eggProfit = eggSales.reduce((acc, i) => acc + i.netMargin, 0);
    const profitPerCrate = totalCratesSold > 0 ? (eggProfit / totalCratesSold).toFixed(2) : "2.20";

    const totalMeatKgSold = broilerSales.reduce((acc, i) => acc + (i.totalWeightKg || (i.quantity * 2.4)), 0);
    const meatProfit = broilerSales.reduce((acc, i) => acc + i.netMargin, 0);
    const profitPerKg = totalMeatKgSold > 0 ? (meatProfit / totalMeatKgSold).toFixed(2) : "1.09";

    res.status(200).json({
      success: true,
      data: {
        financialSummary: {
          totalRevenue: totalRevenue.toFixed(2),
          totalCost: totalCost.toFixed(2),
          netProfit: netProfit.toFixed(2),
          overallMargin: `${overallMargin}%`,
          profitPerCrate: `$${profitPerCrate} / crate`,
          profitPerKgMeat: `$${profitPerKg} / kg live`,
        },
        invoices: salesInvoices.slice().reverse(),
      }
    });
  } catch (err) {
    next(err);
  }
}

async function createInvoice(req, res, next) {
  try {
    const {
      customerName,
      itemCategory,
      details,
      quantity,
      unitPrice,
      totalWeightKg,
      productionCost,
      paymentStatus,
      notes,
    } = req.body;

    if (!customerName || !itemCategory || !quantity || !unitPrice) {
      return res.status(400).json({
        success: false,
        message: "Customer name, item category (EGGS or BROILERS), quantity, and unit price are required."
      });
    }

    const qty = Number(quantity);
    const price = Number(unitPrice);
    const weightKg = totalWeightKg ? Number(totalWeightKg) : (itemCategory === "BROILERS" ? qty * 2.3 : null);
    
    // Revenue calculation
    let totalRevenue = 0;
    if (itemCategory === "BROILERS" && weightKg) {
      totalRevenue = Number((weightKg * price).toFixed(2));
    } else {
      totalRevenue = Number((qty * price).toFixed(2));
    }

    // Default estimated cost of production if not provided (approx 65% of sale)
    const cost = productionCost ? Number(productionCost) : Number((totalRevenue * 0.65).toFixed(2));
    const netMargin = Number((totalRevenue - cost).toFixed(2));
    const marginPercentage = totalRevenue > 0 ? ((netMargin / totalRevenue) * 100).toFixed(1) : "0.0";

    const invNum = `INV-2026-${String(nextInvoiceId).padStart(3, "0")}`;

    const newInvoice = {
      id: nextInvoiceId++,
      invoiceNumber: invNum,
      customerName: String(customerName).trim(),
      itemCategory: String(itemCategory).toUpperCase(),
      details: details || (itemCategory === "EGGS" ? "Standard Commercial Crates (30s)" : "Direct Live Broilers"),
      quantity: qty,
      totalWeightKg: weightKg,
      unitPrice: price,
      totalRevenue,
      productionCost: cost,
      netMargin,
      marginPercentage,
      date: new Date().toISOString().slice(0, 10),
      paymentStatus: paymentStatus || "PENDING",
      notes: notes || "",
    };

    salesInvoices.push(newInvoice);
    res.status(201).json({ success: true, data: newInvoice });
  } catch (err) {
    next(err);
  }
}

async function updatePaymentStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { paymentStatus } = req.body;
    const inv = salesInvoices.find(i => i.id === id);
    if (!inv) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }
    inv.paymentStatus = paymentStatus || "PAID";
    res.status(200).json({ success: true, data: inv });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSalesFinancials,
  createInvoice,
  updatePaymentStatus,
};
