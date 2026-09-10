require("dotenv").config();
const app = require("./app");

// Port 3000 is hardcoded and required by the reverse proxy infrastructure.
const PORT = 3000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Poultry management app running on http://${HOST}:${PORT}`);
});
