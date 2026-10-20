BEGIN;

DO $$
DECLARE
    source_entries BIGINT;
    imported_entries BIGINT;
BEGIN
    SELECT COALESCE(SUM(COALESCE(cardinality("history"), 0)), 0)
      INTO source_entries
      FROM "Order";

    INSERT INTO "AuditLog" (
        "id", "actorId", "entityType", "entityId", "action", "before", "after", "createdAt"
    )
    SELECT
        'legacy-history-' || o."id" || '-' || lpad(entry.ordinality::text, 10, '0'),
        NULL,
        'ORDER',
        o."id",
        'LEGACY_HISTORY_IMPORTED',
        NULL,
        jsonb_build_object('legacyHistoryIndex', entry.ordinality, 'record', entry.value),
        o."createdAt"
    FROM "Order" AS o
    CROSS JOIN LATERAL unnest(o."history") WITH ORDINALITY AS entry(value, ordinality);

    GET DIAGNOSTICS imported_entries = ROW_COUNT;
    IF imported_entries <> source_entries THEN
        RAISE EXCEPTION 'Legacy order history migration stopped: expected to preserve % entries but copied %.',
            source_entries, imported_entries;
    END IF;
END $$;

ALTER TABLE "Order" DROP COLUMN "history";

COMMIT;
