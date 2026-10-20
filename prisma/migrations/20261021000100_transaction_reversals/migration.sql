BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Order" o WHERE o."paidAmount" <> COALESCE(
    (SELECT sum(t.amount) FROM "Transaction" t WHERE t."orderId" = o.id AND t.type = 'INCOME'), 0
  )) THEN RAISE EXCEPTION 'Payment ledger must be reconciled before enabling reversals.'; END IF;
END $$;

ALTER TABLE "Transaction"
  ADD COLUMN "reversalOfId" TEXT,
  ADD COLUMN "reversalReason" TEXT;
CREATE UNIQUE INDEX "Transaction_reversalOfId_key" ON "Transaction"("reversalOfId");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_amount_positive_check";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_signed_amount_check" CHECK (
  (amount > 0 AND "reversalOfId" IS NULL AND "reversalReason" IS NULL)
  OR (amount < 0 AND "reversalOfId" IS NOT NULL AND "reversalOfId" <> id
      AND "reversalReason" IS NOT NULL AND length(btrim("reversalReason")) BETWEEN 5 AND 500)
);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_type_check" CHECK (type IN ('INCOME', 'EXPENSE'));

CREATE FUNCTION sultan_validate_transaction_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original "Transaction"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
      RAISE EXCEPTION 'Posted transactions are immutable; append a reversal instead.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."reversalOfId" IS NOT NULL THEN
    SELECT * INTO original FROM "Transaction" WHERE id = NEW."reversalOfId" FOR UPDATE;
    IF NOT FOUND OR original.amount <= 0 OR original."reversalOfId" IS NOT NULL
      OR NEW.amount IS DISTINCT FROM -original.amount
      OR NEW.type IS DISTINCT FROM original.type
      OR NEW.category IS DISTINCT FROM original.category
      OR NEW."orderId" IS DISTINCT FROM original."orderId"
      OR NEW."facilityId" IS DISTINCT FROM original."facilityId"
      OR NEW."customerId" IS DISTINCT FROM original."customerId" THEN
      RAISE EXCEPTION 'A reversal must exactly negate one original transaction in the same ledger scope.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Transaction_immutable_and_reversal_guard"
  BEFORE INSERT OR UPDATE ON "Transaction"
  FOR EACH ROW EXECUTE FUNCTION sultan_validate_transaction_reversal();

-- Check the final transaction state, after both the order balance and ledger entry exist.
CREATE FUNCTION sultan_check_order_payment_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id TEXT; stored_paid NUMERIC; ledger_paid NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'Order' THEN target_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN target_id := OLD."orderId";
  ELSE target_id := NEW."orderId"; END IF;
  IF target_id IS NULL THEN RETURN NULL; END IF;
  SELECT "paidAmount" INTO stored_paid FROM "Order" WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COALESCE(sum(amount), 0) INTO ledger_paid FROM "Transaction" WHERE "orderId" = target_id AND type = 'INCOME';
  IF stored_paid <> ledger_paid THEN RAISE EXCEPTION 'Order paid amount does not match the signed payment ledger.'; END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "Order_payment_ledger_guard"
  AFTER INSERT OR UPDATE ON "Order" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION sultan_check_order_payment_ledger();
CREATE CONSTRAINT TRIGGER "Transaction_order_ledger_guard"
  AFTER INSERT OR UPDATE OR DELETE ON "Transaction" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION sultan_check_order_payment_ledger();

COMMIT;
