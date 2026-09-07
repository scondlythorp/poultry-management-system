const prisma = require("../prisma/client");

const { createHouseSchema, validate } = require("../validators/poultryValidator");
const { NotFoundError, ValidationError } = require("../middleware/errors");
const { catchAsync } = require("../middleware/errorHandler");

/**
 * POST /api/houses
 * Creates a new poultry house.
 */
const createHouse = catchAsync(async (req, res) => {
  const result = validate(createHouseSchema, req.body);

  if (!result.success) {
    throw new ValidationError(result.errors);
  }

  const { name, birdsPlaced, createdAt } = result.data;

  const house = await prisma.poultryHouse.create({
    data: {
      name,
      birdsPlaced,
      createdAt: new Date(createdAt),
    },
  });

  res.status(201).json({
    success: true,
    data: house,
  });
});

/**
 * GET /api/houses
 * Lists all poultry houses, newest first.
 */
const getHouses = catchAsync(async (req, res) => {
  const houses = await prisma.poultryHouse.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    success: true,
    data: houses,
  });
});

/**
 * GET /api/houses/:id
 * Fetches a single poultry house by id.
 */
const getHouseById = catchAsync(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    throw new ValidationError([{ field: "id", message: "House id must be a number" }]);
  }

  const house = await prisma.poultryHouse.findUnique({ where: { id } });

  if (!house) {
    throw new NotFoundError("Poultry house not found");
  }

  res.status(200).json({
    success: true,
    data: house,
  });
});

/**
 * GET /api/houses/:id/dashboard
 * Computes live statistics for a house from its daily records.
 * Nothing here is stored — it's calculated fresh from the database
 * every time, so the database stays the single source of truth.
 */
const getDashboard = catchAsync(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    throw new ValidationError([{ field: "id", message: "House id must be a number" }]);
  }

  const house = await prisma.poultryHouse.findUnique({ where: { id } });

  if (!house) {
    throw new NotFoundError("Poultry house not found");
  }

  // create a single query to aggregate totals for mortality, feedUsedKg, and eggsCollected for the given houseId
  
  const totals = await prisma.dailyRecord.aggregate({
    where: { houseId: id },
    _sum: {
      mortality: true,
      feedUsedKg: true,
      eggsCollected: true,
    },
  });

  const totalMortality = totals._sum.mortality || 0;
  // feedUsedKg is a Prisma Decimal; convert to a plain number for JSON.
  const totalFeedUsedKg = totals._sum.feedUsedKg
    ? Number(totals._sum.feedUsedKg)
    : 0;
  const totalEggsCollected = totals._sum.eggsCollected || 0;

  res.status(200).json({
    success: true,
    data: {
      houseId: house.id,
      houseName: house.name,
      birdsPlaced: house.birdsPlaced,
      currentBirds: house.birdsPlaced - totalMortality,
      totalMortality,
      totalFeedUsedKg,
      totalEggsCollected,
    },
  });
});

module.exports = { createHouse, getHouses, getHouseById, getDashboard };
