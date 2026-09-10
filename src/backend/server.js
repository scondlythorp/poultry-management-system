require("dotenv").config();
const app = require("./app");

// In AI Studio sandboxed container with nginx reverse proxy: listen on port 3000.
// In standalone Cloud Run / Render / Railway: listen on process.env.PORT (or 3000).
const PORT = process.env.NGINX_PORT ? 3000 : (Number(process.env.PORT) || 3000);
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Poultry management app running on http://${HOST}:${PORT}`);
});
