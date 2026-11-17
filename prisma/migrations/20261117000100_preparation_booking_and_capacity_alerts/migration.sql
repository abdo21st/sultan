ALTER TABLE "Facility"
  ADD COLUMN "preparationMinutes" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "Order"
  ADD COLUMN "pickupAt" TIMESTAMP(3),
  ADD COLUMN "preparationMinutes" INTEGER NOT NULL DEFAULT 60;

CREATE INDEX "Order_factoryId_pickupAt_idx" ON "Order"("factoryId", "pickupAt");

ALTER TABLE "CapacityRule"
  ADD COLUMN "warningPercent" INTEGER NOT NULL DEFAULT 80;

CREATE TABLE "CapacityAlert" (
  "id" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "businessDay" DATE NOT NULL,
  "orderCount" INTEGER NOT NULL,
  "maxCapacity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CapacityAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CapacityAlert_factoryId_businessDay_key"
  ON "CapacityAlert"("factoryId", "businessDay");
CREATE INDEX "CapacityAlert_businessDay_idx" ON "CapacityAlert"("businessDay");

ALTER TABLE "CapacityAlert"
  ADD CONSTRAINT "CapacityAlert_factoryId_fkey"
  FOREIGN KEY ("factoryId") REFERENCES "Facility"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
