require("dotenv").config({
  path: require("path").resolve(__dirname, "../src/backend/.env"),
});

const app = require("../src/backend/app");

module.exports = app;