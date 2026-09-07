# Simple Poultry Management App

A small full-stack application for a farm manager to create poultry houses,
record daily mortality/feed/egg data, and view live dashboard statistics.

Built as an internship coding assessment. Scope is intentionally minimal —
no authentication, no extra domain features beyond what was asked for.

## Features

- Create a poultry house (name, birds placed, date created)
- Record daily information per house (mortality, feed used, eggs collected)
- Dashboard per house: current birds, total mortality, total feed used, total eggs collected
- Server-side validation (Zod) and centralized error handling
- Duplicate daily records for the same house/date are rejected
- Mortality that would exceed the current bird count is rejected

## Technology Stack

| Layer      | Technology                  |
|------------|------------------------------|
| Frontend   | HTML5, CSS3, Vanilla JavaScript |
| Backend    | Node.js, Express.js          |
| Database   | PostgreSQL                   |
| ORM        | Prisma                       |
| Validation | Zod                          |

## Project Structure

```
poultry_management_system/
├── backend/
│   ├── controllers/       # Request handlers / business logic
│   ├── middleware/        # Error handling + custom error classes
│   ├── prisma/            # schema.prisma + shared Prisma Client instance
│   ├── routes/            # Express route definitions
│   ├── validators/        # Zod schemas
│   ├── app.js              # Express app configuration
│   └── server.js           # Entry point
└── client/
    ├── css/style.css
    ├── js/app.js            # All frontend logic (fetch calls, DOM updates)
    └── index.html
```

## Requirements

- Node.js 18+
- PostgreSQL 13+ (running locally or accessible remotely)

## Environment Setup

1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create your local `.env` from the template:

   ```bash
   cp .env.example .env
   ```

3. Edit `backend/.env` and set `DATABASE_URL` to your real PostgreSQL
   connection string, e.g.:

   ```
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/poultry_db"
   PORT=3000
   ```

   Make sure the database (`poultry_db` here) already exists in PostgreSQL —
   Prisma migrate creates tables, not the database itself.

## Database Setup

Run the migration to create the tables from `schema.prisma`:

```bash
cd backend
npx prisma migrate dev --name init
```

This also generates the Prisma Client. If you change `schema.prisma` later,
re-run `npx prisma migrate dev --name <description>`.

## Running the Backend

```bash
cd backend
npm start
```

You should see:

```
Poultry management API running on http://localhost:3000
```

Confirm it's alive:

```bash
curl http://localhost:3000/api/health
```

Expected: `{"success":true,"message":"API is running"}`

## Running the Frontend

The frontend is plain static HTML/CSS/JS — no build step. Open
`client/index.html` directly in a browser, or serve it with any static
server, e.g.:

```bash
cd client
npx serve .
```

The frontend expects the API at `http://localhost:3000/api` (see
`API_BASE` at the top of `client/js/app.js` — change it if your backend
runs on a different port).

## API Endpoints

| Method | Endpoint                          | Description                     |
|--------|------------------------------------|----------------------------------|
| GET    | `/api/health`                      | Health check                    |
| POST   | `/api/houses`                      | Create a poultry house          |
| GET    | `/api/houses`                      | List all poultry houses         |
| GET    | `/api/houses/:id`                  | Get one poultry house           |
| GET    | `/api/houses/:id/dashboard`        | Get live dashboard stats        |
| POST   | `/api/houses/:id/daily-records`    | Create a daily record           |
| GET    | `/api/houses/:id/daily-records`    | List daily records for a house  |

### Response format

Success:
```json
{ "success": true, "data": { } }
```

Error:
```json
{ "success": false, "message": "Poultry house not found" }
```

Validation error:
```json
{ "success": false, "message": "Validation failed", "errors": [{ "field": "birdsPlaced", "message": "Birds placed must be greater than zero" }] }
```

## Validation Rules

**House**
- `name`: required, non-empty string
- `birdsPlaced`: required integer, greater than 0
- `createdAt`: required, valid date

**Daily Record**
- `date`: required, valid date
- `mortality`: integer ≥ 0
- `feedUsedKg`: number ≥ 0
- `eggsCollected`: integer ≥ 0
- Business rule: `mortality` cannot exceed the house's current bird count
  (`birdsPlaced` minus mortality already recorded)
- Database constraint: one daily record per house per date
  (`@@unique([houseId, date])`)

## Dashboard Calculation

Computed live from the database on every request — nothing is stored:

```
totalMortality      = SUM(dailyRecord.mortality)      for the house
totalFeedUsedKg      = SUM(dailyRecord.feedUsedKg)      for the house
totalEggsCollected   = SUM(dailyRecord.eggsCollected)   for the house
currentBirds          = birdsPlaced - totalMortality
```

## Testing

See the manual test plan below. Test both valid and invalid inputs for
each endpoint using curl, Postman, or Thunder Client.

```bash
# Health check
curl http://localhost:3000/api/health

# Create a house
curl -X POST http://localhost:3000/api/houses \
  -H "Content-Type: application/json" \
  -d '{"name":"House A","birdsPlaced":500,"createdAt":"2026-09-07"}'

# Invalid house (birdsPlaced <= 0) -> expect 400
curl -X POST http://localhost:3000/api/houses \
  -H "Content-Type: application/json" \
  -d '{"name":"House A","birdsPlaced":-5,"createdAt":"2026-09-07"}'

# Create a daily record (replace :id with the real house id)
curl -X POST http://localhost:3000/api/houses/1/daily-records \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-09-07","mortality":3,"feedUsedKg":25.5,"eggsCollected":420}'

# Duplicate date for the same house -> expect 400
curl -X POST http://localhost:3000/api/houses/1/daily-records \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-09-07","mortality":1,"feedUsedKg":10,"eggsCollected":100}'

# Dashboard
curl http://localhost:3000/api/houses/1/dashboard
```

## Security Notes

- `.env` is git-ignored
- All input is validated server-side (frontend validation is UX only)
- Database credentials are never returned in API responses
- No authentication was implemented (out of scope for this assessment)
