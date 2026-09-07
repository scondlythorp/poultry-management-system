const prisma = require("../prisma/client");
const {
  createDailyRecordSchema,
  validate,
} = require("../validators/poultryValidator");
const {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} = require("../middleware/errors");
const { catchAsync } = require("../middleware/errorHandler");

// creates a daily record for a given poultry house.
// Business rule: mortality cannot exceed the current number of birds available in the house.
// Unique constraint: only one daily record per house per date is allowed.

const createDailyRecord = catchAsync(async (req, res) => {
  const houseId = Number(req.params.id);

  if (!Number.isInteger(houseId)) {
    throw new ValidationError([{ field: "id", message: "House id must be a number" }]);
  }

  const result = validate(createDailyRecordSchema, req.body);

  if (!result.success) {
    throw new ValidationError(result.errors);
  }

  const { date, mortality, feedUsedKg, eggsCollected } = result.data;

  const house = await prisma.poultryHouse.findUnique({ where: { id: houseId } });

  if (!house) {
    throw new NotFoundError("Poultry house not found");
  }

  const totals = await prisma.dailyRecord.aggregate({
    where: { houseId },
    _sum: { mortality: true },
  });

  const currentBirds = house.birdsPlaced - (totals._sum.mortality || 0);

  if (mortality > currentBirds) {
    throw new BusinessRuleError(
      `Mortality (${mortality}) cannot exceed the current number of birds available (${currentBirds}).`
    );
  }

  const dailyRecord = await prisma.dailyRecord.create({
    data: {
      houseId,
      date: new Date(date),
      mortality,
      feedUsedKg,
      eggsCollected,
    },
  });

  res.status(201).json({
    success: true,
    data: dailyRecord,
  });
});

/**
 * GET /api/houses/:id/daily-records
 * Lists all daily records for a house, most recent date first.
 */
const getDailyRecords = catchAsync(async (req, res) => {
  const houseId = Number(req.params.id);

  if (!Number.isInteger(houseId)) {
    throw new ValidationError([{ field: "id", message: "House id must be a number" }]);
  }

  const house = await prisma.poultryHouse.findUnique({ where: { id: houseId } });

  if (!house) {
    throw new NotFoundError("Poultry house not found");
  }

  const records = await prisma.dailyRecord.findMany({
    where: { houseId },
    orderBy: { date: "desc" },
  });

  res.status(200).json({
    success: true,
    data: records,
  });
});

module.exports = { createDailyRecord, getDailyRecords };
