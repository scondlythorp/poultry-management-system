const express = require("express");
const cors = require("cors");
const houseRoutes = require("./routes/houseRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// Allow the frontend to call this API.
app.use(cors());

// Parse incoming JSON request bodies into req.body.
app.use(express.json());

// health checkup
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
  });
});

// All house + nested daily-record routes.
app.use("/api/houses", houseRoutes);

// Catch-all for unknown routes.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handling middleware.
app.use(errorHandler);

module.exports = app;
