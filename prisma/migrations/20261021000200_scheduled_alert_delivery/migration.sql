BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "alertSettingId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "scheduledDay" DATE NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SystemSettings" ADD COLUMN "printTerms" TEXT;
CREATE UNIQUE INDEX "AlertDelivery_alertSettingId_orderId_scheduledDay_channel_reci_key"
    ON "AlertDelivery"("alertSettingId", "orderId", "scheduledDay", "channel", "recipient");
CREATE INDEX "AlertDelivery_status_createdAt_idx" ON "AlertDelivery"("status", "createdAt");
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertSettingId_fkey"
    FOREIGN KEY ("alertSettingId") REFERENCES "AlertSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ScheduledJobState" (
    "id" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    CONSTRAINT "ScheduledJobState_pkey" PRIMARY KEY ("id")
);
COMMIT;
