BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "Order" ADD COLUMN "reviewRequired" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Order" SET "reviewRequired"=true WHERE status IN ('orders:status:review','REVIEW_NEEDED');
UPDATE "Order" SET status=CASE
  WHEN status IN ('REGISTERED','orders:status:review','REVIEW_NEEDED','orders:status:delivering_to_factory','DELIVERING_TO_FACTORY') THEN 'orders:status:registered'
  WHEN status='PROCESSING' THEN 'orders:status:processing'
  WHEN status IN ('TRANSFERRED_TO_SHOP','orders:status:delivering','DELIVERING') THEN 'orders:status:shop_ready'
  WHEN status='COMPLETED' THEN 'orders:status:completed'
  ELSE status END;

UPDATE "AlertSetting" SET "triggerStatus"=CASE
  WHEN "triggerStatus" IN ('orders:status:review','REVIEW_NEEDED') THEN 'orders:needs_correction'
  WHEN "triggerStatus" IN ('REGISTERED','orders:status:delivering_to_factory','DELIVERING_TO_FACTORY') THEN 'orders:status:registered'
  WHEN "triggerStatus"='PROCESSING' THEN 'orders:status:processing'
  WHEN "triggerStatus" IN ('TRANSFERRED_TO_SHOP','orders:status:delivering','DELIVERING') THEN 'orders:status:shop_ready'
  WHEN "triggerStatus"='COMPLETED' THEN 'orders:status:completed'
  ELSE "triggerStatus" END;

UPDATE "CustomRole" SET permissions=ARRAY(SELECT DISTINCT CASE
  WHEN p IN ('orders:status:view:delivering_to_factory','orders:status:view:review') THEN 'orders:status:view:registered'
  WHEN p='orders:status:view:delivering' THEN 'orders:status:view:shop_ready'
  ELSE p END FROM unnest(permissions) p);
UPDATE "User" SET permissions=ARRAY(SELECT DISTINCT CASE
  WHEN p IN ('orders:status:view:delivering_to_factory','orders:status:view:review') THEN 'orders:status:view:registered'
  WHEN p='orders:status:view:delivering' THEN 'orders:status:view:shop_ready'
  ELSE p END FROM unnest(permissions) p);
INSERT INTO "AuditLog"(id,"entityType","entityId",action,"after") VALUES
  ('migration_simple_workflow_20261021','SYSTEM','order-workflow','FOUR_STAGE_WORKFLOW_ADOPTED','{"stages":4,"correctionIsFlag":true,"paymentIndependent":true}'::jsonb);
COMMIT;
