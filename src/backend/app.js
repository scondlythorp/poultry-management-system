const express = require("express");
const cors = require("cors");
const path = require("path");
const houseRoutes = require("./routes/houseRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// Allow the frontend to call this API.
app.use(cors());

// Parse incoming JSON request bodies into req.body.
app.use(express.json());

// health checkup (supports /api/health and /health)
app.get(["/api/health", "/health"], (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
  });
});

// All house + nested daily-record routes (supports both /api/houses and /houses)
app.use(["/api/houses", "/houses"], houseRoutes);

// Catch-all for unknown /api routes.
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Serve static frontend assets from /public
const publicPath = path.resolve(__dirname, "../../public");
app.use(express.static(publicPath));

// Fallback to index.html for non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Error handling middleware.
app.use(errorHandler);

module.exports = app;
