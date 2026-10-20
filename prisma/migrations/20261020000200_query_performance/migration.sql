BEGIN;

CREATE INDEX "Order_factoryId_dueDate_idx" ON "Order"("factoryId", "dueDate");
CREATE INDEX "Order_factoryId_createdAt_id_idx" ON "Order"("factoryId", "createdAt", "id");
CREATE INDEX "Order_shopId_createdAt_id_idx" ON "Order"("shopId", "createdAt", "id");
CREATE INDEX "Order_createdAt_id_idx" ON "Order"("createdAt", "id");
CREATE INDEX "Transaction_date_id_idx" ON "Transaction"("date", "id");
CREATE INDEX "Transaction_facilityId_date_id_idx" ON "Transaction"("facilityId", "date", "id");
CREATE INDEX "Notification_userId_read_createdAt_id_idx" ON "Notification"("userId", "read", "createdAt", "id");

COMMIT;
