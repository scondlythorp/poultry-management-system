const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data so the seed is safe to run repeatedly.
  await prisma.dailyRecord.deleteMany();
  await prisma.poultryHouse.deleteMany();

  // Create a sample poultry house.
  const house = await prisma.poultryHouse.create({
    data: {
      name: 'House A',
      birdsPlaced: 500,
      createdAt: new Date('2026-09-01'),
    },
  });

  // Create sample daily records.
  await prisma.dailyRecord.createMany({
    data: [
      {
        houseId: house.id,
        date: new Date('2026-09-02'),
        mortality: 3,
        feedUsedKg: 25.5,
        eggsCollected: 420,
      },
      {
        houseId: house.id,
        date: new Date('2026-09-03'),
        mortality: 2,
        feedUsedKg: 26.0,
        eggsCollected: 430,
      },
    ],
  });

  console.log(`✅ Created poultry house: ${house.name}`);
  console.log('✅ Created 2 daily records');
  console.log('🌱 Database seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });