import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function requiredLocalConnection() {
  const value = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!value) throw new Error("Set a local PostgreSQL DATABASE_URL before running restore acceptance.");
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Restore acceptance requires PostgreSQL.");
  }
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error("Restore acceptance only permits a loopback PostgreSQL host.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const username = decodeURIComponent(url.username);
  if (!database || !username) throw new Error("The local PostgreSQL connection is incomplete.");

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");
  const testUrl = new URL(url);
  testUrl.searchParams.delete("schema");
  return { adminUrl, testUrl, username };
}

function getContainer() {
  const index = process.argv.indexOf("--container");
  const value = index >= 0 ? process.argv[index + 1] : "sultan-postgres-db";
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value)) {
    throw new Error("Pass a valid local PostgreSQL container with --container.");
  }
  return value;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv, label: string, timeout = 180_000) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    timeout,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed${result.error ? `: ${result.error.message}` : "."}`);
  }
}

async function main() {
  const container = getContainer();
  const { adminUrl, testUrl, username } = requiredLocalConnection();
  const standaloneServer = path.resolve(process.cwd(), ".next/standalone/server.js");
  if (!existsSync(standaloneServer)) {
    throw new Error("Build the standalone application before running restore acceptance.");
  }

  const suffix = randomBytes(6).toString("hex");
  const databaseName = `sultan_restore_source_${suffix}`;
  const isolatedUrl = new URL(testUrl);
  isolatedUrl.pathname = `/${databaseName}`;
  const migrationEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: isolatedUrl.toString(),
    DIRECT_URL: isolatedUrl.toString(),
  };
  const admin = new Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 10_000 });
  let databaseCreated = false;
  let fixture: Client | undefined;

  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    await admin.end();

    const prismaCli = path.resolve(process.cwd(), "node_modules/prisma/build/index.js");
    run(process.execPath, [prismaCli, "migrate", "deploy"], migrationEnv, "Applying migrations to the temporary source database");

    fixture = new Client({ connectionString: isolatedUrl.toString(), connectionTimeoutMillis: 10_000 });
    await fixture.connect();
    await fixture.query('BEGIN');
    const factoryId = `restore_factory_${suffix}`;
    const shopId = `restore_shop_${suffix}`;
    const orderId = `restore_order_${suffix}`;
    const transactionId = `restore_payment_${suffix}`;
    await fixture.query(
      'INSERT INTO "Facility" (id, name, type, location) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)',
      [factoryId, "Restore acceptance factory", "FACTORY", "Synthetic", shopId, "Restore acceptance shop", "SHOP", "Synthetic"],
    );
    await fixture.query(
      `INSERT INTO "Order" (id, "customerName", "customerPhone", description, "dueDate", "totalAmount", "paidAmount", "remainingAmount", images, "factoryId", "shopId", "updatedAt")
       VALUES ($1, 'Synthetic restore customer', '0910000000', 'Isolated encrypted-backup acceptance fixture', NOW() + INTERVAL '7 days', 100.00, 70.00, 30.00, ARRAY[]::text[], $2, $3, NOW())`,
      [orderId, factoryId, shopId],
    );
    await fixture.query(
      `INSERT INTO "Transaction" (id, type, amount, category, "orderId", "facilityId", "updatedAt")
       VALUES ($1, 'INCOME', 100.00, 'PAYMENT', $2, $3, NOW())`,
      [`${transactionId}_mistaken`, orderId, shopId],
    );
    await fixture.query(
      `INSERT INTO "Transaction" (id, type, amount, category, "orderId", "facilityId", "reversalOfId", "reversalReason", "updatedAt")
       VALUES ($1, 'INCOME', -100.00, 'PAYMENT', $2, $3, $4, 'Synthetic full reversal before replacement payment', NOW())`,
      [`${transactionId}_reversal`, orderId, shopId, `${transactionId}_mistaken`],
    );
    await fixture.query(
      `INSERT INTO "Transaction" (id, type, amount, category, description, "orderId", "facilityId", date, "createdAt", "updatedAt")
       VALUES ($1, 'INCOME', 70.00, 'PAYMENT', 'Synthetic restore acceptance payment', $2, $3, NOW(), NOW(), NOW())`,
      [transactionId, orderId, shopId],
    );
    await fixture.query(
      `INSERT INTO "AuditLog" (id, "entityType", "entityId", action, "after")
       VALUES ($1, 'TRANSACTION', $2, 'REVERSAL_CREATED', jsonb_build_object('originalTransactionId', $3::text, 'amount', -100, 'reason', 'Synthetic backup audit acceptance'))`,
      [`restore_audit_${suffix}`, `${transactionId}_reversal`, `${transactionId}_mistaken`],
    );
    await fixture.query('COMMIT');
    const invariant = await fixture.query<{ orders: string; transactions: string; mismatches: string }>(
      `SELECT
         (SELECT count(*) FROM "Order")::text AS orders,
         (SELECT count(*) FROM "Transaction")::text AS transactions,
         (SELECT count(*) FROM "Order" o WHERE round(o."paidAmount"::numeric, 2) <> round(COALESCE((SELECT sum(t.amount::numeric) FROM "Transaction" t WHERE t."orderId" = o.id AND t.type = 'INCOME'), 0), 2))::text AS mismatches`,
    );
    if (invariant.rows[0]?.orders !== "1" || invariant.rows[0]?.transactions !== "3" || invariant.rows[0]?.mismatches !== "0") {
      throw new Error("The synthetic restore source failed its financial consistency check.");
    }
    await fixture.end();
    fixture = undefined;

    const containerProbe = spawnSync("docker", ["exec", container, "psql", "-U", username, "-d", databaseName, "-tAc", "SELECT 1"], {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    });
    if (containerProbe.error || containerProbe.status !== 0 || containerProbe.stdout.trim() !== "1") {
      throw new Error("The selected PostgreSQL container does not contain the loopback database service used by this test.");
    }

    const backupCli = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
    run(process.execPath, [backupCli, "scripts/db-backup-encrypted.ts", "self-test", "--container", container, "--start-app"], migrationEnv, "Encrypted backup, isolated restore, and application startup acceptance", 300_000);
    console.log(JSON.stringify({ mode: "restore-start-acceptance", source: "synthetic-local-database", restoredApplication: "healthy", financialLedger: "reconciled", temporaryDatabase: "removed" }));
  } finally {
    await fixture?.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
    if (databaseCreated) {
      const cleanup = new Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 10_000 });
      await cleanup.connect();
      try {
        await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [databaseName]);
        await cleanup.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      } finally {
        await cleanup.end();
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error("Restore acceptance failed; only randomly named local test databases are used.");
  if (error instanceof Error) console.error(error.message);
  process.exitCode = 1;
});
