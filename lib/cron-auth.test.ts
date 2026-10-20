import { authorizeCronRequest } from "./cron-auth";

const originalSecret = process.env.CRON_SECRET;

function cronRequest(authorization?: string): Request {
  return {
    headers: { get: (name: string) => name.toLowerCase() === "authorization" ? authorization ?? null : null },
  } as unknown as Request;
}

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("authorizeCronRequest", () => {
  it("rejects requests when no cron secret is configured", () => {
    delete process.env.CRON_SECRET;
    expect(authorizeCronRequest(cronRequest())).toBe("unconfigured");
  });

  it("accepts only the matching bearer secret", () => {
    process.env.CRON_SECRET = "test-cron-secret";
    expect(authorizeCronRequest(cronRequest("Bearer test-cron-secret"))).toBe("authorized");
    expect(authorizeCronRequest(cronRequest("Bearer wrong"))).toBe("unauthorized");
  });
});
