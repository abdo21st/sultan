import { expect, test } from "@playwright/test";

test("health check exposes only service status", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("sensitive API routes reject unauthenticated access", async ({ request }) => {
  const cases = [
    ["/api/orders", 403],
    ["/api/audit", 401],
    ["/api/settings/backup", 401],
    ["/api/admin/reports", 403],
  ] as const;

  for (const [path, expectedStatus] of cases) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(expectedStatus);
  }
});

test("scheduled maintenance endpoints reject unauthenticated access", async ({ request }) => {
  const cleanup = await request.get("/api/cron/blob-cleanup");
  expect([401, 503]).toContain(cleanup.status());

  const keepAlive = await request.get("/api/cron/keep-alive");
  expect([401, 503]).toContain(keepAlive.status());
});

test("destructive endpoints reject unauthenticated requests and caller-controlled WhatsApp sends stay disabled", async ({ request }) => {
  const cases = [
    ["/api/settings/clear-data", 401],
    ["/api/settings/factory-reset", 403],
    ["/api/users/bulk-delete", 403],
    ["/api/whatsapp/send", 410],
  ] as const;

  for (const [path, expectedStatus] of cases) {
    const response = await request.post(path, {
      data: { confirmation: "test", phone: "000", message: "test" },
    });
    expect(response.status(), path).toBe(expectedStatus);
  }
});
