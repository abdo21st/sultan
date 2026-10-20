import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";

// This suite mutates one disposable database. A retry requires a new complete
// runner invocation so a previous payment is never replayed against used fixtures.
test.describe.configure({ mode: "serial", retries: 0 });

function fixture(key: string) {
  return process.env[`E2E_${key}`];
}

async function readOfflineQueueCount(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open("SultanAppDB");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction("orders", "readonly").objectStore("orders").count();
      request.onerror = () => {
        database.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        database.close();
        resolve(request.result);
      };
    };
  }));
}

async function signIn(request: APIRequestContext, username: string | undefined, password: string | undefined) {
  if (!username || !password) test.skip(true, "Run with npm run test:e2e:isolated to create temporary role fixtures.");
  const csrfResponse = await request.get("/api/auth/csrf");
  expect(csrfResponse.status()).toBe(200);
  const { csrfToken } = await csrfResponse.json();
  const login = await request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      username: username!,
      password: password!,
      callbackUrl: "http://localhost:4317/",
      json: "true",
    },
    headers: { "X-Auth-Return-Redirect": "1" },
  });
  expect(login.status()).toBe(200);
  const session = await request.get("/api/auth/session");
  expect((await session.json()).user?.id).toBeTruthy();
}

test("facility user sees only assigned orders and no financial fields", async ({ request }) => {
  await signIn(request, fixture("USER_USERNAME"), fixture("USER_PASSWORD"));
  const ownOrderId = fixture("OWN_ORDER_ID")!;
  const foreignOrderId = fixture("FOREIGN_ORDER_ID")!;

  const ownResponse = await request.get(`/api/orders/${ownOrderId}`);
  expect(ownResponse.status()).toBe(200);
  const ownOrder = await ownResponse.json();
  expect(ownOrder).not.toHaveProperty("totalAmount");
  expect(ownOrder).not.toHaveProperty("paidAmount");
  expect(ownOrder).not.toHaveProperty("remainingAmount");

  const foreignResponse = await request.get(`/api/orders/${foreignOrderId}`);
  expect(foreignResponse.status()).toBe(404);

  const listResponse = await request.get("/api/orders?limit=100");
  expect(listResponse.status()).toBe(200);
  const listedOrders = await listResponse.json();
  expect(listedOrders.map((order: { id: string }) => order.id)).toContain(ownOrderId);
  expect(listedOrders.map((order: { id: string }) => order.id)).not.toContain(foreignOrderId);

  expect((await request.patch(`/api/orders/${ownOrderId}`)).status()).toBe(403);
  expect((await request.post("/api/transactions", { data: {} })).status()).toBe(403);
});

test("facility user cannot retrieve an image from another facility's order", async ({ request }) => {
  await signIn(request, fixture("USER_USERNAME"), fixture("USER_PASSWORD"));
  const foreignOrderId = fixture("FOREIGN_ORDER_ID")!;

  const image = await request.get(`/api/orders/${foreignOrderId}/images/0`);
  expect(image.status()).toBe(404);

  const invalidIndex = await request.get(`/api/orders/${fixture("OWN_ORDER_ID")}/images/1`);
  expect(invalidIndex.status()).toBe(404);
});

test("order update rejects an image reference owned by a different order", async ({ request }) => {
  await signIn(request, fixture("MANAGER_USERNAME"), fixture("MANAGER_PASSWORD"));
  const ownOrderId = fixture("OWN_ORDER_ID")!;
  const foreignOrderId = fixture("FOREIGN_ORDER_ID")!;

  const response = await request.patch(`/api/orders/${ownOrderId}`, {
    multipart: {
      customerName: "E2E Shop A Customer",
      customerPhone: "0910000001",
      description: "Image ownership acceptance check",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      totalAmount: "100.00",
      factoryId: fixture("FACTORY_ID")!,
      shopId: fixture("SHOP_ID")!,
      existingImages: JSON.stringify([`/api/orders/${foreignOrderId}/images/0`]),
    },
  });
  expect(response.status()).toBe(400);

  const order = await request.get(`/api/orders/${ownOrderId}`);
  expect(order.status()).toBe(200);
  expect((await order.json()).images).toEqual([`/api/orders/${ownOrderId}/images/0`]);
});

test("private local images require access and support conditional reads", async ({ request }) => {
  test.skip(process.env.ORDER_IMAGE_STORAGE !== "local", "Run the isolated local-storage acceptance.");
  const ownImage = `/api/orders/${fixture("OWN_ORDER_ID")}/images/0`;
  expect((await request.get(ownImage)).status()).toBe(404);
  await signIn(request, fixture("USER_USERNAME"), fixture("USER_PASSWORD"));
  const image = await request.get(ownImage);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect(image.headers()["cache-control"]).toBe("private, no-cache");
  expect((await image.body()).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const cached = await request.get(ownImage, { headers: { "If-None-Match": image.headers().etag } });
  expect(cached.status()).toBe(304);
  expect((await request.get(`/api/orders/${fixture("FOREIGN_ORDER_ID")}/images/0`)).status()).toBe(404);
});

test("uploaded local images are retained privately and deleted after removing their reference", async ({ request }) => {
  test.skip(process.env.ORDER_IMAGE_STORAGE !== "local", "Run the isolated local-storage acceptance.");
  await signIn(request, fixture("MANAGER_USERNAME"), fixture("MANAGER_PASSWORD"));
  const directory = process.env.ORDER_IMAGE_STORAGE_DIR!;
  const before = (await readdir(directory)).sort();
  const id = fixture("OWN_ORDER_ID")!;
  const fields = {
    customerName: "E2E Shop A Customer", customerPhone: "0910000001",
    description: "Private local image acceptance", totalAmount: "100.00",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    factoryId: fixture("FACTORY_ID")!, shopId: fixture("SHOP_ID")!,
    existingImages: JSON.stringify([`/api/orders/${id}/images/0`]),
  };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=", "base64");
  const uploaded = await request.patch(`/api/orders/${id}`, {
    multipart: { ...fields, newImages: { name: "../../customer.png", mimeType: "image/png", buffer: png } },
  });
  expect(uploaded.status()).toBe(200);
  expect((await uploaded.json()).images).toEqual([`/api/orders/${id}/images/0`, `/api/orders/${id}/images/1`]);
  expect((await readdir(directory)).length).toBe(before.length + 1);
  const image = await request.get(`/api/orders/${id}/images/1`);
  expect(image.status()).toBe(200);
  expect(await image.body()).toEqual(png);
  expect((await request.patch(`/api/orders/${id}`, { multipart: fields })).status()).toBe(200);
  expect((await readdir(directory)).sort()).toEqual(before);
  expect((await request.get(`/api/orders/${id}/images/1`)).status()).toBe(404);
  expect((await request.get(`/api/orders/${id}/images/0`)).status()).toBe(200);
});

test("accountant can record one concurrent payment and idempotent retry without over-collecting", async ({ request }) => {
  await signIn(request, fixture("ACCOUNTANT_USERNAME"), fixture("ACCOUNTANT_PASSWORD"));
  const orderId = fixture("OWN_ORDER_ID")!;
  const firstKey = randomUUID();
  const secondKey = randomUUID();
  const payment = (idempotencyKey: string, amount = 50) => request.post("/api/transactions", {
    data: { type: "INCOME", amount, category: "SALES", orderId, idempotencyKey },
  });

  expect((await payment(randomUUID(), 20)).status()).toBe(200);
  expect((await payment(randomUUID(), -1)).status()).toBe(400);
  expect((await payment(randomUUID(), 81)).status()).toBe(409);

  const competingPayments = await Promise.all([payment(firstKey), payment(secondKey)]);
  expect(competingPayments.map((response) => response.status()).sort()).toEqual([200, 409]);
  const winnerIndex = competingPayments.findIndex((response) => response.status() === 200);
  const winnerBody = await competingPayments[winnerIndex].json();
  const winnerKey = winnerIndex === 0 ? firstKey : secondKey;

  const retry = await payment(winnerKey);
  expect(retry.status()).toBe(200);
  expect((await retry.json()).id).toBe(winnerBody.id);

  const orderResponse = await request.get(`/api/orders/${orderId}`);
  expect(orderResponse.status()).toBe(200);
  const order = await orderResponse.json();
  expect(order.paidAmount).toBe(70);
  expect(order.remainingAmount).toBe(30);

  const transactionsResponse = await request.get("/api/transactions?limit=100");
  expect(transactionsResponse.status()).toBe(200);
  const transactions = await transactionsResponse.json();
  expect(transactions).toHaveLength(2);
  expect(transactions.map((transaction: { id: string }) => transaction.id)).toContain(winnerBody.id);
});

test("facility accountant cannot inspect or replay another facility's payment", async ({ request }) => {
  await signIn(request, fixture("ADMIN_USERNAME"), fixture("ADMIN_PASSWORD"));
  const foreignOrderId = fixture("FOREIGN_ORDER_ID")!;
  const idempotencyKey = randomUUID();
  const payment = {
    type: "INCOME",
    amount: 5,
    category: "SALES",
    orderId: foreignOrderId,
    idempotencyKey,
  };
  const created = await request.post("/api/transactions", { data: payment });
  expect(created.status()).toBe(200);

  await signIn(request, fixture("ACCOUNTANT_USERNAME"), fixture("ACCOUNTANT_PASSWORD"));
  const replay = await request.post("/api/transactions", { data: payment });
  expect(replay.status()).toBe(404);
  const replayBody = await replay.json();
  expect(replayBody).not.toHaveProperty("id");
  expect(replayBody).not.toHaveProperty("amount");

  const newKey = await request.post("/api/transactions", {
    data: { ...payment, idempotencyKey: randomUUID() },
  });
  expect(newKey.status()).toBe(404);
});

test("manager cannot run destructive operations even with an untrusted confirmation", async ({ request }) => {
  await signIn(request, fixture("MANAGER_USERNAME"), fixture("MANAGER_PASSWORD"));
  const cases = [
    ["/api/settings/clear-data", 403],
    ["/api/settings/factory-reset", 403],
    ["/api/users/bulk-delete", 403],
  ] as const;

  for (const [path, expectedStatus] of cases) {
    const response = await request.post(path, { data: { confirmation: "test" } });
    expect(response.status(), path).toBe(expectedStatus);
  }
});

test("offline order retry with the same client request ID creates only one order", async ({ request }) => {
  await signIn(request, fixture("MANAGER_USERNAME"), fixture("MANAGER_PASSWORD"));
  const clientRequestId = randomUUID();
  const originalOrder = {
    clientRequestId,
    customerName: "E2E Offline Retry",
    customerPhone: "0910000003",
    description: "Idempotent offline synchronization fixture",
    dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    totalAmount: "50.00",
    paidAmount: "0.00",
    factoryId: fixture("FACTORY_ID")!,
    shopId: fixture("SHOP_ID")!,
  };
  const createOrder = (payload: typeof originalOrder) => request.post("/api/orders", { multipart: payload });

  const first = await createOrder(originalOrder);
  expect(first.status()).toBe(200);
  const firstOrder = await first.json();

  const retry = await createOrder(originalOrder);
  expect(retry.status()).toBe(200);
  expect((await retry.json()).id).toBe(firstOrder.id);

  const conflictingRetry = await createOrder({ ...originalOrder, customerName: "Different payload" });
  expect(conflictingRetry.status()).toBe(409);

  const orders = await request.get("/api/orders?limit=100");
  const ids = (await orders.json()).map((order: { id: string }) => order.id);
  expect(ids.filter((id: string) => id === firstOrder.id)).toHaveLength(1);
});

test("admin can see both facilities but destructive endpoints require the exact confirmation", async ({ request }) => {
  await signIn(request, fixture("ADMIN_USERNAME"), fixture("ADMIN_PASSWORD"));
  const ownOrderId = fixture("OWN_ORDER_ID")!;
  const foreignOrderId = fixture("FOREIGN_ORDER_ID")!;

  expect((await request.get(`/api/orders/${ownOrderId}`)).status()).toBe(200);
  expect((await request.get(`/api/orders/${foreignOrderId}`)).status()).toBe(200);

  const before = await request.get("/api/orders?limit=100");
  expect(before.status()).toBe(200);
  const beforeIds = (await before.json()).map((order: { id: string }) => order.id).sort();
  expect(beforeIds).toContain(ownOrderId);
  expect(beforeIds).toContain(foreignOrderId);
  expect(beforeIds).toHaveLength(3);

  for (const path of ["/api/settings/clear-data", "/api/settings/factory-reset", "/api/users/bulk-delete"]) {
    const response = await request.post(path, { data: {} });
    expect(response.status(), path).toBe(400);
  }

  const after = await request.get("/api/orders?limit=100");
  expect((await after.json()).map((order: { id: string }) => order.id).sort()).toEqual(beforeIds);
});

test("browser queues an order while offline and synchronizes it once after reconnecting", async ({ page, request }) => {
  await signIn(request, fixture("MANAGER_USERNAME"), fixture("MANAGER_PASSWORD"));
  const sessionState = await request.storageState();
  await page.context().addCookies(sessionState.cookies);

  await page.goto("/orders/new");
  await expect(page.getByRole("heading", { name: "إنشاء طلب جديد" })).toBeVisible();
  await expect(page.locator('select[name="factoryId"] option').nth(1)).toBeAttached();
  await page.context().setOffline(true);
  await expect(page.getByText("بدون إنترنت", { exact: true })).toBeVisible();

  const customerName = `E2E Browser Offline ${randomUUID()}`;
  await page.locator('input[name="customerName"]').fill(customerName);
  await page.locator('input[name="customerPhone"]').fill("0910000005");
  await page.locator('textarea[name="description"]').fill("Actual browser offline queue and reconnect acceptance");
  await page.locator('input[name="totalAmount"]').fill("90.00");
  await page.locator('input[name="dueDate"]').fill(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  await page.locator('select[name="factoryId"]').selectOption({ index: 1 });

  await page.getByRole("button", { name: "إنشاء الطلب" }).click();
  await expect(page.getByRole("status")).toContainText("تم حفظ الطلب محليًا");
  await expect.poll(() => readOfflineQueueCount(page)).toBe(1);

  await page.context().setOffline(false);
  await expect(page.getByText(/تمت مزامنة 1 طلبات بنجاح/)).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => readOfflineQueueCount(page)).toBe(0);

  const savedOrders = await page.request.get("http://localhost:4317/api/orders?limit=100");
  expect(savedOrders.status()).toBe(200);
  const orders = await savedOrders.json();
  expect(orders.filter((order: { customerName: string }) => order.customerName === customerName)).toHaveLength(1);
});

test("offline navigation reopens the app path and syncs its saved order after reconnecting", async ({ page, request }) => {
  await signIn(request, fixture("MANAGER_USERNAME"), fixture("MANAGER_PASSWORD"));
  const sessionState = await request.storageState();
  await page.context().addCookies(sessionState.cookies);

  await page.goto("/orders/new");
  await expect(page.getByRole("heading", { name: "إنشاء طلب جديد" })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const cachedPaths = await page.evaluate(async () => {
    const cache = await caches.open("sultan-offline-shell-v1");
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths).toEqual(["/offline.html"]);


  await page.context().setOffline(true);
  const customerName = `E2E Reopened Offline ${randomUUID()}`;
  await page.locator('input[name="customerName"]').fill(customerName);
  await page.locator('input[name="customerPhone"]').fill("0910000006");
  await page.locator('textarea[name="description"]').fill("Offline queue survives closing and reopening the app");
  await page.locator('input[name="totalAmount"]').fill("125.00");
  await page.locator('input[name="dueDate"]').fill(new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  await page.locator('select[name="factoryId"]').selectOption({ index: 1 });

  await page.getByRole("button", { name: "إنشاء الطلب" }).click();
  await expect(page.getByRole("status")).toContainText("تم حفظ الطلب محليًا");
  await expect.poll(() => readOfflineQueueCount(page)).toBe(1);
  await page.close();

  const reopenedPage = await page.context().newPage();
  const offlineResponse = await reopenedPage.goto("/orders/new");
  expect(offlineResponse?.status()).toBe(200);
  await expect(reopenedPage.getByRole("heading", { name: "أنت غير متصل بالإنترنت" })).toBeVisible();
  await expect(reopenedPage.getByText("بانتظار عودة الاتصال.", { exact: true })).toBeVisible();

  await reopenedPage.context().setOffline(false);
  await expect(reopenedPage.getByRole("heading", { name: "إنشاء طلب جديد" })).toBeVisible({ timeout: 15_000 });
  await expect(reopenedPage.getByText(/تمت مزامنة 1 طلبات بنجاح/)).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => readOfflineQueueCount(reopenedPage)).toBe(0);

  const savedOrders = await reopenedPage.request.get("http://localhost:4317/api/orders?limit=100");
  expect(savedOrders.status()).toBe(200);
  const orders = await savedOrders.json();
  expect(orders.filter((order: { customerName: string }) => order.customerName === customerName)).toHaveLength(1);
});
