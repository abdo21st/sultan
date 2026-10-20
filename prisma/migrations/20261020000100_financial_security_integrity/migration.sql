BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Order"
        WHERE "totalAmount" <= 0 OR "paidAmount" < 0 OR "remainingAmount" < 0
           OR "paidAmount" > "totalAmount"
           OR "totalAmount" > 999999999999.99
           OR "paidAmount" > 999999999999.99
           OR "remainingAmount" > 999999999999.99
           OR "totalAmount"::numeric <> round("totalAmount"::numeric, 2)
           OR "paidAmount"::numeric <> round("paidAmount"::numeric, 2)
           OR "remainingAmount"::numeric <> round("remainingAmount"::numeric, 2)
           OR round("remainingAmount"::numeric, 2) <> round(("totalAmount" - "paidAmount")::numeric, 2)
    ) THEN
        RAISE EXCEPTION 'Financial migration stopped: order totals need reconciliation or cent-level review. Run npm run db:financial-preflight.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "Transaction"
        WHERE amount <= 0 OR amount > 999999999999.99
           OR amount::numeric <> round(amount::numeric, 2)
    ) THEN
        RAISE EXCEPTION 'Financial migration stopped: transaction amounts need cent-level review. Run npm run db:financial-preflight.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "Transaction"
        WHERE "orderId" IS NOT NULL AND type <> 'INCOME'
    ) THEN
        RAISE EXCEPTION 'Financial migration stopped: an order is linked to a non-income transaction.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "Transaction" t
        WHERE t."orderId" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o.id = t."orderId")
    ) THEN
        RAISE EXCEPTION 'Financial migration stopped: orphaned transaction order references were found.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "Order" o
        WHERE round(o."paidAmount"::numeric, 2) <>
              round(COALESCE((SELECT sum(t.amount::numeric) FROM "Transaction" t WHERE t."orderId" = o.id AND t.type = 'INCOME'), 0), 2)
    ) THEN
        RAISE EXCEPTION 'Financial migration stopped: order payment ledger mismatches need reconciliation. Run npm run db:financial-preflight.';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "clientRequestId" TEXT,
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "remainingAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "facilityId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_money_valid_check"
CHECK (
    "totalAmount" > 0 AND "paidAmount" >= 0 AND "remainingAmount" >= 0
    AND "paidAmount" <= "totalAmount"
    AND "remainingAmount" = "totalAmount" - "paidAmount"
);

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_amount_positive_check" CHECK (amount > 0);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientRequestId_key" ON "Order"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_facilityId_idx" ON "Transaction"("facilityId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
