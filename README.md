# Poultry Management System

This project is a small full-stack app for managing poultry houses and daily farm records. The goal is simple: create houses, enter production data for each day, and view a live summary of birds, feed, eggs, and mortality.

It was built as a practical assessment app, so the scope stays focused on the core workflow without auth, billing, reporting dashboards beyond the basics, or extra business layers.

## What it does

- Create poultry houses with a name, initial bird count, and date
- Record daily metrics for each house:
  - mortality
  - feed used (kg)
  - eggs collected
- Prevent duplicate daily entries for the same house on the same date
- Block invalid records where mortality would exceed the current bird count
- Show per-house dashboard totals calculated live from the database

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod

## Project structure

```text
poultry_management_system/
├── src/
│   ├── backend/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── prisma/
│   │   ├── routes/
│   │   ├── validators/
│   │   ├── app.js
│   │   ├── server.js
│   │   └── package.json
│   └── client/
│       ├── css/
│       ├── js/
│       └── index.html
└── README.md
```

## Requirements

- Node.js 18+
- PostgreSQL 13+

## Setup

From the backend folder:

```bash
cd src/backend
npm install
```

Create a `.env` file in `src/backend` with your database connection and port:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/poultry_farm_db"
PORT=3000
```

Make sure the PostgreSQL database already exists before running Prisma migrations.

## Database setup

Run the migration to create the schema:

```bash
cd src/backend
npx prisma migrate dev --name init
```

If you change the Prisma schema later, run a new migration:

```bash
npx prisma migrate dev --name <description>
```

## Running the app

Start the backend:

```bash
cd src/backend
npm start
```

You should see output similar to:

```text
Poultry management API running on http://localhost:3000
```

Check the health endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{ "success": true, "message": "API is running" }
```

Open the frontend in a browser from `src/client/index.html`, or serve it with a static server:

```bash
cd src/client
npx serve .
```

The frontend is configured to call the API at `http://localhost:3000/api` by default.

## API overview

### Houses

- `GET /api/houses` - list all houses
- `POST /api/houses` - create a house
- `GET /api/houses/:id` - get a single house
- `GET /api/houses/:id/dashboard` - get live dashboard stats

### Daily records

- `GET /api/houses/:id/daily-records` - list records for a house
- `POST /api/houses/:id/daily-records` - create a record

### Response format

Success:

```json
{ "success": true, "data": {} }
```

Error:

```json
{ "success": false, "message": "Poultry house not found" }
```

Validation error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "birdsPlaced", "message": "Birds placed must be greater than zero" }]
}
```

## Validation rules

### House

- `name`: required, non-empty string
- `birdsPlaced`: required integer, must be greater than 0
- `createdAt`: required valid date

### Daily record

- `date`: required valid date
- `mortality`: integer, minimum 0
- `feedUsedKg`: number, minimum 0
- `eggsCollected`: integer, minimum 0
- `mortality` cannot exceed the current bird count for that house
- only one record is allowed per house per date

## Dashboard calculation

The dashboard values are calculated from the database on each request:

```text
totalMortality    = sum of all recorded mortality for the house
totalFeedUsedKg   = sum of feed used for the house
totalEggsCollected = sum of eggs collected for the house
currentBirds      = birdsPlaced - totalMortality
```

## Example requests

```bash
# Create a house
curl -X POST http://localhost:3000/api/houses \
  -H "Content-Type: application/json" \
  -d '{"name":"House A","birdsPlaced":500,"createdAt":"2026-09-07"}'

# Add a daily record
curl -X POST http://localhost:3000/api/houses/1/daily-records \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-09-07","mortality":3,"feedUsedKg":25.5,"eggsCollected":420}'

# Fetch dashboard
curl http://localhost:3000/api/houses/1/dashboard
```

## Notes

- The app uses server-side validation and does not trust the frontend alone.
- `.env` should be kept local and not committed.
- This project intentionally avoids auth and broader farm management features, since the scope is limited to the requested workflow.
