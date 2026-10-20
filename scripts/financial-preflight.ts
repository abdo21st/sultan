import { config as loadEnv } from 'dotenv'
import pg from 'pg'

loadEnv({ path: '.env.local', quiet: true })
loadEnv({ path: '.env', quiet: true })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('Set DIRECT_URL or DATABASE_URL before running the financial preflight.')
}

const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 })

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    const { rows: [features] } = await client.query<{ hasReversals: boolean }>(`SELECT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Transaction' AND column_name = 'reversalOfId'
    ) AS "hasReversals"`)
    const validReversal = features.hasReversals ? `t."reversalOfId" IS NOT NULL AND t.amount < 0
      AND length(btrim(t."reversalReason")) BETWEEN 5 AND 500
      AND EXISTS (SELECT 1 FROM "Transaction" original WHERE original.id = t."reversalOfId" AND original.amount > 0
        AND original."reversalOfId" IS NULL AND t.amount = -original.amount AND t.type = original.type
        AND t.category = original.category AND t."orderId" IS NOT DISTINCT FROM original."orderId"
        AND t."facilityId" IS NOT DISTINCT FROM original."facilityId" AND t."customerId" IS NOT DISTINCT FROM original."customerId")` : 'false'
    const validOriginal = features.hasReversals ? `t.amount > 0 AND t."reversalOfId" IS NULL AND t."reversalReason" IS NULL` : 't.amount > 0'
    const { rows: [row] } = await client.query<{
      orderCount: string
      invalidOrderCount: string
      subcentOrderCount: string
      oversizedOrderCount: string
      remainingMismatchCount: string
      transactionCount: string
      invalidTransactionCount: string
      invalidTransactionTypeCount: string
      reversalCount: string
      subcentTransactionCount: string
      oversizedTransactionCount: string
      linkedNonIncomeTransactionCount: string
      orphanTransactionCount: string
      paymentLedgerMismatchCount: string
    }>(`
      WITH order_ledger AS (
        SELECT o.id, o."paidAmount"::numeric AS paid,
               COALESCE(sum(t.amount::numeric) FILTER (WHERE t.type = 'INCOME'), 0) AS income
        FROM "Order" o
        LEFT JOIN "Transaction" t ON t."orderId" = o.id
        GROUP BY o.id
      )
      SELECT
        (SELECT count(*) FROM "Order")::text AS "orderCount",
        (SELECT count(*) FROM "Order"
          WHERE "totalAmount" <= 0 OR "paidAmount" < 0 OR "remainingAmount" < 0
             OR "paidAmount" > "totalAmount")::text AS "invalidOrderCount",
        (SELECT count(*) FROM "Order"
          WHERE "totalAmount"::numeric * 100 <> trunc("totalAmount"::numeric * 100)
             OR "paidAmount"::numeric * 100 <> trunc("paidAmount"::numeric * 100)
             OR "remainingAmount"::numeric * 100 <> trunc("remainingAmount"::numeric * 100))::text AS "subcentOrderCount",
        (SELECT count(*) FROM "Order"
          WHERE "totalAmount" > 999999999999.99 OR "paidAmount" > 999999999999.99
             OR "remainingAmount" > 999999999999.99)::text AS "oversizedOrderCount",
        (SELECT count(*) FROM "Order"
          WHERE round("remainingAmount"::numeric, 2) <>
                round(("totalAmount" - "paidAmount")::numeric, 2))::text AS "remainingMismatchCount",
        (SELECT count(*) FROM "Transaction")::text AS "transactionCount",
        (SELECT count(*) FROM "Transaction" t WHERE NOT COALESCE(((${validOriginal}) OR (${validReversal})), false))::text AS "invalidTransactionCount",
        (SELECT count(*) FROM "Transaction" WHERE type NOT IN ('INCOME', 'EXPENSE'))::text AS "invalidTransactionTypeCount",
        (${features.hasReversals ? 'SELECT count(*) FROM "Transaction" WHERE "reversalOfId" IS NOT NULL' : 'SELECT 0'})::text AS "reversalCount",
        (SELECT count(*) FROM "Transaction"
          WHERE amount::numeric * 100 <> trunc(amount::numeric * 100))::text AS "subcentTransactionCount",
        (SELECT count(*) FROM "Transaction" WHERE abs(amount) > 999999999999.99)::text AS "oversizedTransactionCount",
        (SELECT count(*) FROM "Transaction" WHERE "orderId" IS NOT NULL AND type <> 'INCOME')::text AS "linkedNonIncomeTransactionCount",
        (SELECT count(*) FROM "Transaction" t
          WHERE t."orderId" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o.id = t."orderId"))::text AS "orphanTransactionCount",
        (SELECT count(*) FROM order_ledger
          WHERE round(paid, 2) <> round(income, 2))::text AS "paymentLedgerMismatchCount"
    `)
    await client.query('COMMIT')

    const metrics = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, Number(value)]),
    )
    console.log(JSON.stringify({ readOnly: true, metrics }, null, 2))

    const issueFields = [
      'invalidOrderCount',
      'subcentOrderCount',
      'oversizedOrderCount',
      'remainingMismatchCount',
      'invalidTransactionCount',
      'invalidTransactionTypeCount',
      'subcentTransactionCount',
      'oversizedTransactionCount',
      'linkedNonIncomeTransactionCount',
      'orphanTransactionCount',
      'paymentLedgerMismatchCount',
    ]
    if (issueFields.some((field) => Number(metrics[field]) > 0)) {
      process.exitCode = 2
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

main()
  .catch((error: unknown) => {
    console.error('Financial preflight failed; no database changes were made.')
    if (error instanceof Error) console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
