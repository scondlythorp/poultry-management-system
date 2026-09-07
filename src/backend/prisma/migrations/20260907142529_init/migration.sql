-- CreateTable
CREATE TABLE "poultry_houses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "birdsPlaced" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poultry_houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_records" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mortality" INTEGER NOT NULL DEFAULT 0,
    "feedUsedKg" DECIMAL(10,2) NOT NULL,
    "eggsCollected" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_records_houseId_idx" ON "daily_records"("houseId");

-- CreateIndex
CREATE INDEX "daily_records_date_idx" ON "daily_records"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_records_houseId_date_key" ON "daily_records"("houseId", "date");

-- AddForeignKey
ALTER TABLE "daily_records" ADD CONSTRAINT "daily_records_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "poultry_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
