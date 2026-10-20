import { timingSafeEqual } from "node:crypto";

export type CronAuthResult = "authorized" | "unconfigured" | "unauthorized";

export function authorizeCronRequest(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "unconfigured";

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) return "unauthorized";
  return timingSafeEqual(providedBytes, expectedBytes) ? "authorized" : "unauthorized";
}
