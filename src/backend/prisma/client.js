// backend/prisma/client.js

// In-memory data store for when PostgreSQL is not configured / accessible
const inMemoryStore = {
  poultryHouses: [
    {
      id: 1,
      name: "House A",
      birdsPlaced: 500,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  ],
  dailyRecords: [
    {
      id: 1,
      houseId: 1,
      date: new Date("2026-09-02T00:00:00.000Z"),
      mortality: 3,
      feedUsedKg: 25.5,
      eggsCollected: 420,
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
    },
    {
      id: 2,
      houseId: 1,
      date: new Date("2026-09-03T00:00:00.000Z"),
      mortality: 2,
      feedUsedKg: 26.0,
      eggsCollected: 430,
      createdAt: new Date("2026-09-03T00:00:00.000Z"),
    },
  ],
  nextHouseId: 2,
  nextRecordId: 3,
};

const mockPrisma = {
  poultryHouse: {
    findMany: async (args = {}) => {
      let list = [...inMemoryStore.poultryHouses];
      if (args.orderBy && args.orderBy.createdAt === "desc") {
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return list;
    },
    findUnique: async (args = {}) => {
      const id = args.where?.id;
      const found = inMemoryStore.poultryHouses.find((h) => h.id === Number(id));
      return found ? { ...found } : null;
    },
    create: async (args = {}) => {
      const data = args.data || {};
      const newHouse = {
        id: inMemoryStore.nextHouseId++,
        name: data.name,
        birdsPlaced: Number(data.birdsPlaced),
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      };
      inMemoryStore.poultryHouses.push(newHouse);
      return { ...newHouse };
    },
    deleteMany: async () => {
      const count = inMemoryStore.poultryHouses.length;
      inMemoryStore.poultryHouses = [];
      return { count };
    },
  },
  dailyRecord: {
    findMany: async (args = {}) => {
      let list = [...inMemoryStore.dailyRecords];
      if (args.where?.houseId) {
        list = list.filter((r) => r.houseId === Number(args.where.houseId));
      }
      if (args.orderBy && args.orderBy.date === "desc") {
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      return list;
    },
    findUnique: async (args = {}) => {
      const id = args.where?.id;
      const found = inMemoryStore.dailyRecords.find((r) => r.id === Number(id));
      return found ? { ...found } : null;
    },
    create: async (args = {}) => {
      const data = args.data || {};
      const houseId = Number(data.houseId);
      const targetDateStr = new Date(data.date).toISOString().slice(0, 10);

      const existing = inMemoryStore.dailyRecords.find(
        (r) =>
          r.houseId === houseId &&
          new Date(r.date).toISOString().slice(0, 10) === targetDateStr
      );
      if (existing) {
        const err = new Error("Unique constraint failed on the fields: (`houseId`,`date`)");
        err.code = "P2002";
        throw err;
      }

      const newRecord = {
        id: inMemoryStore.nextRecordId++,
        houseId,
        date: data.date ? new Date(data.date) : new Date(),
        mortality: Number(data.mortality || 0),
        feedUsedKg: Number(data.feedUsedKg || 0),
        eggsCollected: Number(data.eggsCollected || 0),
        createdAt: new Date(),
      };
      inMemoryStore.dailyRecords.push(newRecord);
      return { ...newRecord };
    },
    createMany: async (args = {}) => {
      const records = args.data || [];
      records.forEach((r) => {
        inMemoryStore.dailyRecords.push({
          id: inMemoryStore.nextRecordId++,
          houseId: Number(r.houseId),
          date: r.date ? new Date(r.date) : new Date(),
          mortality: Number(r.mortality || 0),
          feedUsedKg: Number(r.feedUsedKg || 0),
          eggsCollected: Number(r.eggsCollected || 0),
          createdAt: new Date(),
        });
      });
      return { count: records.length };
    },
    aggregate: async (args = {}) => {
      const houseId = args.where?.houseId;
      const filtered = houseId
        ? inMemoryStore.dailyRecords.filter((r) => r.houseId === Number(houseId))
        : inMemoryStore.dailyRecords;

      const sumMortality = filtered.reduce((acc, r) => acc + (r.mortality || 0), 0);
      const sumFeed = filtered.reduce((acc, r) => acc + (Number(r.feedUsedKg) || 0), 0);
      const sumEggs = filtered.reduce((acc, r) => acc + (r.eggsCollected || 0), 0);

      return {
        _sum: {
          mortality: sumMortality,
          feedUsedKg: sumFeed,
          eggsCollected: sumEggs,
        },
      };
    },
    deleteMany: async () => {
      const count = inMemoryStore.dailyRecords.length;
      inMemoryStore.dailyRecords = [];
      return { count };
    },
  },
  $disconnect: async () => {},
};

let prisma;

const hasDatabaseUrl =
  Boolean(process.env.DATABASE_URL) &&
  process.env.DATABASE_URL.trim() !== "" &&
  !process.env.DATABASE_URL.includes("localhost:5432");

if (hasDatabaseUrl) {
  try {
    const { PrismaClient } = require("@prisma/client");
    prisma = new PrismaClient();
  } catch (err) {
    console.warn("[AI Studio] PrismaClient initialization failed, falling back to in-memory store:", err.message);
    prisma = mockPrisma;
  }
} else {
  console.log("[AI Studio] No active database configured — using in-memory mock store");
  prisma = mockPrisma;
}

module.exports = prisma;

