# Poultry Management System

A full-stack poultry farm management application for tracking poultry houses and recording daily production metrics (bird population, mortality, feed usage, and egg collection) with live dashboard statistics.

---

## Features

- **Poultry House Management**: Register houses with initial bird counts and placement dates.
- **Daily Metric Logging**: Record daily mortality, feed consumption (kg), and egg collection.
- **Strict Business Logic & Validation**:
  - Validates all inputs server-side with **Zod**.
  - Prevents duplicate daily entries for the same house on the same calendar date.
  - Enforces biological constraints: mortality cannot exceed current live bird count.
- **Live Aggregated Dashboard**: Instant calculation of total mortality, total feed used, total eggs collected, and current live bird population.
- **Zero-Config In-Memory Mode**: Works immediately out of the box with built-in mock data—no local PostgreSQL installation required to get started.
- **PostgreSQL + Prisma**: Seamlessly connects to a real PostgreSQL database whenever `DATABASE_URL` is configured.
- **Multi-Platform Deployment Ready**: Pre-configured for Google Cloud Run, AI Studio, Vercel, Render/Railway, or static hosts with local storage fallback.

---

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 with responsive custom design
- **Backend**: Node.js & Express
- **Database / ORM**: Prisma ORM with PostgreSQL (and zero-config in-memory fallback)
- **Validation**: Zod schema validation
- **Deployment**: Node.js standalone server, Cloud Run, Vercel serverless functions

---

## Project Structure

```text
poultry_management_system/
├── api/
│   └── index.js              # Serverless entry point (Vercel)
├── public/                   # Static frontend assets (served by Express)
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── index.html
├── src/
│   ├── backend/
│   │   ├── controllers/      # Express route controllers (houses, daily records)
│   │   ├── middleware/       # Error handling and validation wrappers
│   │   ├── prisma/           # Prisma schema, client, and in-memory store
│   │   ├── routes/           # Express router endpoints
│   │   ├── validators/       # Zod schemas & business logic rules
│   │   ├── app.js            # Express application setup
│   │   └── server.js         # HTTP server listener
│   └── client/               # Client source files
├── server.js                 # Root entry point
├── package.json              # Dependencies and run scripts
├── vercel.json               # Serverless rewrite rules for Vercel
└── README.md
```

---

## Quick Start (Zero-Config)

You can run the application immediately without installing or configuring PostgreSQL.

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Open the application**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

The Express server automatically hosts both the API endpoints (`/api/*`) and the frontend interface (`/public`).

---

## Using PostgreSQL (Optional)

To connect to a persistent PostgreSQL database:

1. Create a `.env` file in the project root (or set the environment variable):
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/poultry_farm_db"
   ```

2. Generate the Prisma client and apply migrations:
   ```bash
   npx prisma generate --schema=src/backend/prisma/schema.prisma
   npx prisma migrate dev --name init --schema=src/backend/prisma/schema.prisma
   ```

3. Start the application:
   ```bash
   npm start
   ```

*Note: If the database is ever unreachable or unconfigured, the app automatically and safely falls back to the in-memory store so it never crashes.*

---

## API Reference

### Health Check
- `GET /api/health` — Check API availability.

### Houses
- `GET /api/houses` — List all registered houses (newest first).
- `POST /api/houses` — Register a new poultry house.
  - Body: `{"name": "House A", "birdsPlaced": 500, "createdAt": "2026-09-01"}`
- `GET /api/houses/:id` — Retrieve a single house by ID.
- `GET /api/houses/:id/dashboard` — Live computed summary:
  ```json
  {
    "success": true,
    "data": {
      "houseId": 1,
      "houseName": "House A",
      "birdsPlaced": 500,
      "currentBirds": 495,
      "totalMortality": 5,
      "totalFeedUsedKg": 51.5,
      "totalEggsCollected": 850
    }
  }
  ```

### Daily Records
- `GET /api/houses/:id/daily-records` — List all daily entries for a house.
- `POST /api/houses/:id/daily-records` — Log a daily record:
  - Body: `{"date": "2026-09-02", "mortality": 3, "feedUsedKg": 25.5, "eggsCollected": 420}`

---

## Business Logic & Validation Rules

- **Houses**:
  - `name`: Non-empty string.
  - `birdsPlaced`: Positive integer (`> 0`).
  - `createdAt`: Valid ISO date.
- **Daily Records**:
  - `date`: Valid date string (strictly one entry per house per calendar date).
  - `mortality`: Non-negative integer (`>= 0`).
  - `feedUsedKg`: Non-negative decimal (`>= 0`).
  - `eggsCollected`: Non-negative integer (`>= 0`).
  - **Biological Constraint**: Daily mortality cannot exceed the remaining live bird count.

---

## Deployment Options

- **Google Cloud Run / AI Studio**: Fully compatible out of the box with the internal reverse proxy on port `3000` or standard Cloud Run dynamic port injection.
- **Vercel**: Includes `vercel.json` routing all `/api/*` requests to `/api/index.js` while serving the frontend statically.
- **Render / Railway / Heroku**: Reads `PORT` dynamically and binds to `0.0.0.0`.
- **Static Hosting (GitHub Pages)**: If the frontend is hosted without a Node.js server, the frontend automatically activates a browser `localStorage` engine so the interface remains fully operational.
