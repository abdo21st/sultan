BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE "OrderAdjustment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('CANCEL', 'RETURN')),
  "status" TEXT NOT NULL DEFAULT 'REQUESTED' CHECK ("status" IN ('REQUESTED', 'APPROVED', 'REJECTED')),
  "reason" TEXT NOT NULL CHECK (length(btrim("reason")) BETWEEN 5 AND 1000),
  "requestedBy" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "originalStatus" TEXT NOT NULL,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "refundAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "refundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT "OrderAdjustment_refund_valid" CHECK (
    "refundAmount" >= 0 AND "refundedAmount" >= 0 AND "refundedAmount" <= "refundAmount"
    AND ("status" = 'APPROVED' OR ("refundAmount" = 0 AND "refundedAmount" = 0))
  )
);
CREATE UNIQUE INDEX "OrderAdjustment_requestKey_key" ON "OrderAdjustment"("requestKey");
CREATE UNIQUE INDEX "OrderAdjustment_one_open_per_order" ON "OrderAdjustment"("orderId") WHERE status IN ('REQUESTED','APPROVED');
CREATE INDEX "OrderAdjustment_orderId_idx" ON "OrderAdjustment"("orderId");
CREATE INDEX "OrderAdjustment_status_requestedAt_idx" ON "OrderAdjustment"("status","requestedAt");
ALTER TABLE "Transaction" ADD COLUMN "adjustmentId" TEXT REFERENCES "OrderAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Transaction_adjustmentId_idx" ON "Transaction"("adjustmentId");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_refund_scope_check" CHECK (
  "adjustmentId" IS NULL OR (type='EXPENSE' AND "orderId" IS NULL AND category='ORDER_REFUND')
);

CREATE FUNCTION sultan_check_adjustment_refund_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT; stored NUMERIC; ledger NUMERIC;
BEGIN
  IF TG_TABLE_NAME='OrderAdjustment' THEN target:=NEW.id;
  ELSIF TG_OP='DELETE' THEN target:=OLD."adjustmentId";
  ELSE target:=NEW."adjustmentId"; END IF;
  IF target IS NULL THEN RETURN NULL; END IF;
  SELECT "refundedAmount" INTO stored FROM "OrderAdjustment" WHERE id=target FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COALESCE(sum(amount),0) INTO ledger FROM "Transaction" WHERE "adjustmentId"=target AND type='EXPENSE';
  IF stored<>ledger THEN RAISE EXCEPTION 'Adjustment refund does not match the signed expense ledger.'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "OrderAdjustment_refund_ledger_guard" AFTER INSERT OR UPDATE ON "OrderAdjustment"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sultan_check_adjustment_refund_ledger();
CREATE CONSTRAINT TRIGGER "Transaction_adjustment_ledger_guard" AFTER INSERT OR UPDATE OR DELETE ON "Transaction"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sultan_check_adjustment_refund_ledger();

CREATE FUNCTION sultan_guard_closed_order_finances() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."totalAmount",NEW."paidAmount",NEW."remainingAmount") IS DISTINCT FROM (OLD."totalAmount",OLD."paidAmount",OLD."remainingAmount")
    AND EXISTS(SELECT 1 FROM "OrderAdjustment" WHERE "orderId"=OLD.id AND status='APPROVED') THEN
    RAISE EXCEPTION 'Approved cancellations and returns retain the original payment ledger. Use the refund settlement ledger.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Order_closed_financial_guard" BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION sultan_guard_closed_order_finances();

CREATE FUNCTION sultan_guard_refund_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_adjustment TEXT; approved BOOLEAN;
BEGIN
  IF NEW."reversalOfId" IS NOT NULL THEN
    SELECT "adjustmentId" INTO source_adjustment FROM "Transaction" WHERE id=NEW."reversalOfId";
    IF NEW."adjustmentId" IS DISTINCT FROM source_adjustment THEN RAISE EXCEPTION 'Refund reversal must retain its adjustment scope.'; END IF;
  END IF;
  IF NEW."adjustmentId" IS NOT NULL THEN
    SELECT status='APPROVED' INTO approved FROM "OrderAdjustment" WHERE id=NEW."adjustmentId";
    IF NOT COALESCE(approved,false) THEN RAISE EXCEPTION 'Refund requires an approved adjustment.'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Transaction_refund_scope_guard" BEFORE INSERT ON "Transaction" FOR EACH ROW EXECUTE FUNCTION sultan_guard_refund_scope();
COMMIT;
