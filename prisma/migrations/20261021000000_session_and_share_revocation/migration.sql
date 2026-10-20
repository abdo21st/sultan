ALTER TABLE "User"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order" ADD COLUMN "shareVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD CONSTRAINT "User_sessionVersion_nonnegative" CHECK ("sessionVersion" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_shareVersion_nonnegative" CHECK ("shareVersion" >= 0);
