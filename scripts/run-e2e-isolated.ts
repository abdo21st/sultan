import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, Pool } from "pg";
import bcrypt from "bcryptjs";
import { PERMISSIONS } from "../lib/permissions";
import { ORDER_STATUS } from "../lib/constants";
import { persistOrderStatusTransition } from "../lib/order-status-transition";
import { saveLocalImage } from "../lib/local-image-storage";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const sourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("A local PostgreSQL DATABASE_URL is required.");

const parsedSource = new URL(sourceUrl);
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsedSource.hostname)) {
  throw new Error("The isolated E2E runner only permits a loopback PostgreSQL host.");
}

const suffix = `${Date.now().toString(36)}_${randomBytes(5).toString("hex")}`;
const databaseName = `sultan_e2e_${suffix}`;
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.delete("schema");

const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
adminUrl.searchParams.delete("schema");

let databaseCreated = false;
let pool: Pool | undefined;
let prisma: PrismaClient | undefined;
let imageDirectory: string | undefined;

async function createIsolatedDatabase() {
  const admin = new Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
  } finally {
    await admin.end();
  }
}

async function createFixtures() {
  pool = new Pool({ connectionString: testUrl.toString(), max: 5 });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=", "base64");

  const factory = await prisma.facility.create({
    data: { name: `E2E Factory ${suffix}`, type: "FACTORY", location: "Test only" },
  });
  const shopA = await prisma.facility.create({
    data: { name: `E2E Shop A ${suffix}`, type: "SHOP", location: "Test only" },
  });
  const shopB = await prisma.facility.create({
    data: { name: `E2E Shop B ${suffix}`, type: "SHOP", location: "Test only" },
  });

  const credentials = {
    admin: { username: `e2e_admin_${suffix}`, password: randomBytes(24).toString("base64url") },
    manager: { username: `e2e_manager_${suffix}`, password: randomBytes(24).toString("base64url") },
    accountant: { username: `e2e_accountant_${suffix}`, password: randomBytes(24).toString("base64url") },
    user: { username: `e2e_user_${suffix}`, password: randomBytes(24).toString("base64url") },
  };

  const createUser = async (
    role: "ADMIN" | "MANAGER" | "ACCOUNTANT" | "USER",
    login: { username: string; password: string },
    facilityId: string | null,
    permissions: string[] = [],
  ) => prisma!.user.create({
    data: {
      username: login.username,
      password: await bcrypt.hash(login.password, 12),
      displayName: login.username,
      role,
      facilityId,
      permissions,
    },
    select: { id: true },
  });

  const admin = await createUser("ADMIN", credentials.admin, null);
  const manager = await createUser("MANAGER", credentials.manager, shopA.id);
  const accountant = await createUser("ACCOUNTANT", credentials.accountant, shopA.id);
  await createUser("USER", credentials.user, shopA.id, [PERMISSIONS.STATUS_VIEW_REGISTERED]);

  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const ownOrder = await prisma.order.create({
    data: {
      customerName: "E2E Shop A Customer",
      customerPhone: "0910000001",
      description: "Isolated authorization and payment fixture",
      dueDate,
      totalAmount: "100.00",
      paidAmount: "0.00",
      remainingAmount: "100.00",
      images: [await saveLocalImage(new File([png], "own.png", { type: "image/png" }))],
      factoryId: factory.id,
      shopId: shopA.id,
    },
    select: { id: true },
  });
  const foreignOrder = await prisma.order.create({
    data: {
      customerName: "E2E Shop B Customer",
      customerPhone: "0910000002",
      description: "Isolated cross-facility fixture",
      dueDate,
      totalAmount: "200.00",
      paidAmount: "0.00",
      remainingAmount: "200.00",
      images: [await saveLocalImage(new File([png], "foreign.png", { type: "image/png" }))],
      factoryId: factory.id,
      shopId: shopB.id,
    },
    select: { id: true },
  });

  return {
    credentials,
    adminId: admin.id,
    accountantId: accountant.id,
    managerId: manager.id,
    factoryId: factory.id,
    shopId: shopA.id,
    ownOrderId: ownOrder.id,
    foreignOrderId: foreignOrder.id,
  };
}

async function cleanupDatabase() {
  await prisma?.$disconnect().catch(() => undefined);
  await pool?.end().catch(() => undefined);
  if (!databaseCreated) return;

  const admin = new Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
  await admin.connect();
  try {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    databaseCreated = false;
  } finally {
    await admin.end();
  }
}

async function main() {
  try {
    await createIsolatedDatabase();
    console.log(`Created isolated E2E database ${databaseName}.`);
    imageDirectory = await mkdtemp(path.join(tmpdir(), "sultan-e2e-images-"));
    process.env.ORDER_IMAGE_STORAGE = "local";
    process.env.ORDER_IMAGE_STORAGE_DIR = imageDirectory;

    const authSecret = randomBytes(32).toString("base64url");
    const testEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: testUrl.toString(),
      DIRECT_URL: testUrl.toString(),
      AUTH_SECRET: authSecret,
      NEXTAUTH_SECRET: authSecret,
      AUTH_TRUST_HOST: "true",
      AUTH_URL: "http://localhost:4317",
      NEXTAUTH_URL: "http://localhost:4317",
    };

    const prismaCli = path.resolve(process.cwd(), "node_modules/prisma/build/index.js");
    const migration = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      cwd: process.cwd(),
      env: testEnv,
      stdio: "inherit",
    });
    if (migration.error || migration.status !== 0) {
      throw new Error("Prisma migrations failed on the isolated E2E database.");
    }

    const fixtures = await createFixtures();
    Object.assign(testEnv, {
      E2E_ADMIN_USERNAME: fixtures.credentials.admin.username,
      E2E_ADMIN_PASSWORD: fixtures.credentials.admin.password,
      E2E_MANAGER_USERNAME: fixtures.credentials.manager.username,
      E2E_MANAGER_PASSWORD: fixtures.credentials.manager.password,
      E2E_ACCOUNTANT_USERNAME: fixtures.credentials.accountant.username,
      E2E_ACCOUNTANT_PASSWORD: fixtures.credentials.accountant.password,
      E2E_USER_USERNAME: fixtures.credentials.user.username,
      E2E_USER_PASSWORD: fixtures.credentials.user.password,
      E2E_ACCOUNTANT_ID: fixtures.accountantId,
      E2E_FACTORY_ID: fixtures.factoryId,
      E2E_SHOP_ID: fixtures.shopId,
      E2E_OWN_ORDER_ID: fixtures.ownOrderId,
      E2E_FOREIGN_ORDER_ID: fixtures.foreignOrderId,
    });

    const standaloneStatic = path.resolve(process.cwd(), ".next/standalone/.next/static");
    await mkdir(path.dirname(standaloneStatic), { recursive: true });
    await cp(path.resolve(process.cwd(), ".next/static"), standaloneStatic, { recursive: true });
    await cp(path.resolve(process.cwd(), "public"), path.resolve(process.cwd(), ".next/standalone/public"), { recursive: true });

    const playwrightCli = path.resolve(process.cwd(), "node_modules/@playwright/test/cli.js");
    const tests = spawnSync(process.execPath, [playwrightCli, "test", "--config", "config/playwright/playwright.config.ts", "--grep-invert", "@reversal|@offline_images"], {
      cwd: process.cwd(),
      env: testEnv,
      stdio: "inherit",
      timeout: 20 * 60 * 1000,
    });
    if (tests.error || tests.status !== 0) {
      throw new Error("Playwright failed on the isolated E2E database.");
    }

    const statusRaceOrder = await prisma!.order.create({
      data: {
        customerName: "E2E concurrent status customer",
        customerPhone: "0910000004",
        description: "Database-level compare-and-set acceptance fixture",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        totalAmount: "100.00",
        paidAmount: "0.00",
        remainingAmount: "100.00",
        images: [],
        factoryId: fixtures.factoryId,
        shopId: fixtures.shopId,
      },
      select: { id: true, status: true },
    });
    let readyTransitions = 0;
    let releaseTransitions!: () => void;
    const startTogether = new Promise<void>((resolveStart) => { releaseTransitions = resolveStart; });
    const applyTransition = () => prisma!.$transaction(async (tx) => {
      readyTransitions += 1;
      if (readyTransitions === 2) releaseTransitions();
      await startTogether;
      return persistOrderStatusTransition(tx, {
        orderId: statusRaceOrder.id,
        actorId: fixtures.managerId,
        currentStatus: statusRaceOrder.status,
        newStatus: ORDER_STATUS.DELIVERING_TO_FACTORY,
      });
    });
    const transitionResults = await Promise.all([applyTransition(), applyTransition()]);
    const changedStatusOrder = await prisma!.order.findUniqueOrThrow({
      where: { id: statusRaceOrder.id },
      select: { status: true },
    });
    const statusAuditRecords = await prisma!.auditLog.findMany({
      where: { action: "STATUS_CHANGED", entityType: "ORDER", entityId: statusRaceOrder.id },
      select: { actorId: true, before: true, after: true },
    });
    const statusTransitionAcceptance = {
      attempts: transitionResults.length,
      successes: transitionResults.filter(Boolean).length,
      conflicts: transitionResults.filter((result) => !result).length,
      status: changedStatusOrder.status,
      auditRecords: statusAuditRecords.length,
    };
    console.log(JSON.stringify({ databaseStatusTransitionConcurrency: statusTransitionAcceptance }));
    if (
      statusTransitionAcceptance.successes !== 1 ||
      statusTransitionAcceptance.conflicts !== 1 ||
      statusTransitionAcceptance.status !== ORDER_STATUS.DELIVERING_TO_FACTORY ||
      statusAuditRecords.length !== 1 ||
      statusAuditRecords[0]?.actorId !== fixtures.managerId ||
      JSON.stringify(statusAuditRecords[0]?.before) !== JSON.stringify({ status: ORDER_STATUS.REGISTERED }) ||
      JSON.stringify(statusAuditRecords[0]?.after) !== JSON.stringify({ status: ORDER_STATUS.DELIVERING_TO_FACTORY, rejectionReason: null })
    ) {
      throw new Error("Database-level status transition concurrency acceptance failed.");
    }

    const counts = await prisma!.$transaction(async (tx) => ({
      users: await tx.user.count(),
      orders: await tx.order.count(),
      transactions: await tx.transaction.count(),
      paymentAuditRecords: await tx.auditLog.findMany({
        where: { action: "PAYMENT_RECORDED" },
        select: { actorId: true, entityType: true },
      }),
      ledgerOrders: await tx.order.findMany({
        select: {
          paidAmount: true,
          transactions: {
            where: { type: "INCOME" },
            select: { amount: true },
          },
        },
      }),
      ownOrder: await tx.order.findUnique({
        where: { id: fixtures.ownOrderId },
        select: { paidAmount: true, remainingAmount: true },
      }),
    }));
    const ledgerMismatches = counts.ledgerOrders.filter((order) =>
      Math.round(order.paidAmount.toNumber() * 100) !==
      Math.round(order.transactions.reduce((sum, transaction) => sum + transaction.amount.toNumber(), 0) * 100),
    ).length;
    console.log(JSON.stringify({
      isolatedDatabaseCounts: {
        users: counts.users,
        orders: counts.orders,
        transactions: counts.transactions,
        paymentAuditRecords: counts.paymentAuditRecords.length,
        ledgerMismatches,
        paidAmount: counts.ownOrder?.paidAmount.toNumber(),
        remainingAmount: counts.ownOrder?.remainingAmount.toNumber(),
      },
    }));
    if (
      counts.users !== 4 ||
      counts.orders !== 6 ||
      counts.transactions !== 3 ||
      counts.paymentAuditRecords.length !== 6 ||
      counts.paymentAuditRecords.some((entry) => ![fixtures.adminId, fixtures.accountantId].includes(entry.actorId ?? "")) ||
      counts.paymentAuditRecords.map((entry) => entry.entityType).sort().join(",") !== "ORDER,ORDER,ORDER,TRANSACTION,TRANSACTION,TRANSACTION" ||
      ledgerMismatches !== 0 ||
      counts.ownOrder?.paidAmount.toNumber() !== 70 ||
      counts.ownOrder?.remainingAmount.toNumber() !== 30
    ) {
      throw new Error("Isolated E2E database did not match expected payment and retention invariants.");
    }
    console.log("Isolated E2E database invariants passed; fixture data remained isolated.");
    // Add delivered fixtures only after asserting the unchanged primary acceptance counts.
    for (const [label, status] of [['CURRENT', ORDER_STATUS.COMPLETED], ['LEGACY', 'COMPLETED']] as const) {
      const delivered = await prisma!.$transaction(async tx => {
        const order = await tx.order.create({ data: {
          customerName: `Delivered correction ${label}`, customerPhone: '0910000008', description: 'Synthetic delivered-order financial acceptance',
          dueDate: new Date(), status, totalAmount: 100, paidAmount: 100, remainingAmount: 0, images: [],
          factoryId: fixtures.factoryId, shopId: fixtures.shopId,
        } });
        const payment = await tx.transaction.create({ data: { type: 'INCOME', amount: 100, category: 'SALES', orderId: order.id, facilityId: fixtures.shopId, createdBy: fixtures.adminId } });
        await tx.auditLog.create({ data: { actorId: fixtures.adminId, entityType: 'ORDER', entityId: order.id, action: 'COMPLETED',
          before: { status: ORDER_STATUS.DELIVERING, paidAmount: 0, remainingAmount: 100 }, after: { status, paidAmount: 100, remainingAmount: 0 } } });
        return { order, payment };
      });
      testEnv[`E2E_DELIVERED_${label}_ORDER_ID`] = delivered.order.id;
      testEnv[`E2E_DELIVERED_${label}_PAYMENT_ID`] = delivered.payment.id;
    }
    const reversalTests = spawnSync(process.execPath, [playwrightCli, 'test', '--config', 'config/playwright/playwright.config.ts', '--grep', '@reversal'], {
      cwd: process.cwd(), env: testEnv, stdio: 'inherit', timeout: 10 * 60 * 1000,
    });
    if (reversalTests.error || reversalTests.status !== 0) throw new Error('Financial reversal acceptance failed.');
    const reversalInvariant = await prisma!.$queryRaw<{ mismatches: bigint; reversals: bigint }[]>`
      SELECT (SELECT count(*) FROM "Order" o WHERE o."paidAmount" <> COALESCE((SELECT sum(amount) FROM "Transaction" t WHERE t."orderId"=o.id AND t.type='INCOME'),0)) AS mismatches,
        (SELECT count(*) FROM "Transaction" WHERE "reversalOfId" IS NOT NULL) AS reversals`;
    console.log(JSON.stringify({ reversalLedger: { mismatches: Number(reversalInvariant[0].mismatches), reversals: Number(reversalInvariant[0].reversals) } }));
    if (Number(reversalInvariant[0].mismatches) !== 0 || Number(reversalInvariant[0].reversals) !== 7) throw new Error('Reversal ledger invariant failed.');

    const original = await prisma!.transaction.findFirstOrThrow({ where: { orderId: fixtures.ownOrderId, amount: { gt: 0 } } });
    async function mustReject(operation: () => Promise<unknown>, expected: RegExp) {
      try { await operation(); return false; }
      catch (error) { if (error instanceof Error && expected.test(error.message)) return true; throw error; }
    }
    const databaseGuards = {
      negativeWithoutSource: await mustReject(() => prisma!.transaction.create({ data: { type: 'INCOME', amount: -1, category: 'SALES' } }), /Transaction_signed_amount_check/),
      wrongReversalScope: await mustReject(() => prisma!.transaction.create({ data: { type: 'EXPENSE', amount: original.amount.negated(), category: original.category, reversalOfId: original.id, reversalReason: 'Invalid ledger scope acceptance' } }), /exactly negate one original/),
      originalImmutable: await mustReject(() => prisma!.transaction.update({ where: { id: original.id }, data: { amount: original.amount.plus(1) } }), /Posted transactions are immutable/),
      inconsistentOrderBalance: await mustReject(() => prisma!.order.update({ where: { id: fixtures.ownOrderId }, data: { paidAmount: { increment: 1 }, remainingAmount: { decrement: 1 } } }), /Order paid amount does not match/),
      invalidType: await mustReject(() => prisma!.transaction.create({ data: { type: 'UNKNOWN', amount: 1, category: 'SALES' } }), /Transaction_type_check/),
    };
    console.log(JSON.stringify({ databaseReversalGuards: databaseGuards }));
    if (!Object.values(databaseGuards).every(Boolean)) throw new Error('A database reversal guard was bypassed.');
    const preflight = spawnSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/financial-preflight.ts'], {
      cwd: process.cwd(), env: testEnv, encoding: 'utf8', timeout: 30_000,
    });
    if (preflight.error || preflight.status !== 0) throw new Error('Financial preflight rejected a valid signed reversal ledger.');
    const financial = JSON.parse(preflight.stdout) as { metrics: { reversalCount: number; paymentLedgerMismatchCount: number } };
    if (financial.metrics.reversalCount !== 7 || financial.metrics.paymentLedgerMismatchCount !== 0) throw new Error('Financial preflight missed reversal entries.');
    console.log(JSON.stringify({ reversalPreflight: financial.metrics }));
    const beforeReset = { orders: await prisma!.order.count(), transactions: await prisma!.transaction.count() };
    let resetRollback = false;
    try {
      await prisma!.$transaction(async tx => {
        await tx.transaction.deleteMany({});
        await tx.order.deleteMany({});
        await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
        if (await tx.order.count() !== 0 || await tx.transaction.count() !== 0) throw new Error('Synthetic reset did not clear its own rows.');
        throw new Error('ROLL_BACK_SYNTHETIC_RESET');
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'ROLL_BACK_SYNTHETIC_RESET') resetRollback = true;
      else throw error;
    }
    if (!resetRollback || await prisma!.order.count() !== beforeReset.orders || await prisma!.transaction.count() !== beforeReset.transactions) throw new Error('Synthetic reset rollback failed.');
    console.log(JSON.stringify({ destructiveResetCompatibility: true, rolledBack: true, restoredFixtureCounts: beforeReset }));
    const imagesBefore = new Set(await readdir(imageDirectory!));
    const offlineImages = spawnSync(process.execPath, [playwrightCli, 'test', '--config', 'config/playwright/playwright.config.ts', '--grep', '@offline_images'], {
      cwd: process.cwd(), env: testEnv, stdio: 'inherit', timeout: 10 * 60 * 1000,
    });
    if (offlineImages.error || offlineImages.status !== 0) throw new Error('Offline image acceptance failed.');
    const offlineOrders = await prisma!.order.findMany({ where: { customerName: { startsWith: 'E2E Offline Image ' } }, select: { id: true, clientRequestId: true, paidAmount: true, images: true } });
    const imagesAdded = (await readdir(imageDirectory!)).filter(name => !imagesBefore.has(name));
    const offlineCreatedAudits = await prisma!.auditLog.count({ where: { entityType: 'ORDER', action: 'CREATED', entityId: { in: offlineOrders.map(order => order.id) } } });
    if (offlineOrders.length !== 5 || new Set(offlineOrders.map(order => order.clientRequestId)).size !== 5 || offlineOrders.some(order => !order.clientRequestId || order.images.length !== 1 || !order.paidAmount.eq(0)) || imagesAdded.length !== 5 || offlineCreatedAudits !== 5) throw new Error('Offline image acceptance created duplicate records, missing images, or orphaned files.');
    console.log(JSON.stringify({ offlineImageAcceptance: { orders: offlineOrders.length, uniqueClientKeys: 5, imageFilesAdded: imagesAdded.length, creationAudits: offlineCreatedAudits, disposableProfileRestart: true, previousClientQueueCompatible: true } }));
  } finally {
    try {
      await cleanupDatabase();
    } finally {
      if (imageDirectory) {
        const resolved = await realpath(imageDirectory);
        if (path.dirname(resolved) !== await realpath(tmpdir()) || !path.basename(resolved).startsWith('sultan-e2e-images-')) throw new Error('Unsafe isolated image cleanup path.');
        await rm(resolved, { recursive: true, force: true });
      }
    }
    if (!databaseCreated) console.log(`Dropped isolated E2E database ${databaseName}.`);
  }
}

main().catch((error: unknown) => {
  console.error("Isolated E2E run failed; its temporary database was scheduled for cleanup.");
  if (error instanceof Error) console.error(error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '<redacted>'));
  process.exitCode = 1;
});
