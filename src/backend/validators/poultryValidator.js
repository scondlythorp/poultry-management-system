// Zod validation schemas. allow us to define the expected shape of data and validate it easily.
const { z } = require("zod");

// Validation schema for creating a new house.
const createHouseSchema = z.object({
  name: z
    .string({ required_error: "House name is required" })
    .trim()
    .min(1, "House name cannot be empty"),
  birdsPlaced: z
    .number({ required_error: "Birds placed is required" })
    .int("Birds placed must be a whole number")
    .positive("Birds placed must be greater than zero"),
  createdAt: z
    .string({ required_error: "Created date is required" })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Created date must be a valid date",
    }),
});

// validation schema for creating a new daily record.
const createDailyRecordSchema = z.object({
  date: z
    .string({ required_error: "Date is required" })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Date must be a valid date",
    }),
  mortality: z
    .number({ required_error: "Mortality is required" })
    .int("Mortality must be a whole number")
    .min(0, "Mortality cannot be negative"),
  feedUsedKg: z
    .number({ required_error: "Feed used is required" })
    .min(0, "Feed used cannot be negative"),
  eggsCollected: z
    .number({ required_error: "Eggs collected is required" })
    .int("Eggs collected must be a whole number")
    .min(0, "Eggs collected cannot be negative"),
});

// Validate data against a given schema and return the result.
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return { success: false, errors };
}

module.exports = { createHouseSchema, createDailyRecordSchema, validate };
