import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
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
    const tests = spawnSync(process.execPath, [playwrightCli, "test", "--config", "config/playwright/playwright.config.ts"], {
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
  } finally {
    try {
      await cleanupDatabase();
    } finally {
      if (imageDirectory) await rm(imageDirectory, { recursive: true, force: true });
    }
    if (!databaseCreated) console.log(`Dropped isolated E2E database ${databaseName}.`);
  }
}

main().catch(() => {
  console.error("Isolated E2E run failed; its temporary database was scheduled for cleanup.");
  process.exitCode = 1;
});
