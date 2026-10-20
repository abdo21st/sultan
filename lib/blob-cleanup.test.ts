jest.mock("@vercel/blob", () => {
  class BlobNotFoundError extends Error {}
  return { BlobNotFoundError, del: jest.fn() };
});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    blobDeletion: { findMany: jest.fn(), delete: jest.fn(), update: jest.fn(), upsert: jest.fn() },
    order: { count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@prisma/client", () => ({
  BlobDeletionStatus: { PENDING: "PENDING", NEEDS_ATTENTION: "NEEDS_ATTENTION" },
}));

jest.mock("@/lib/local-image-storage", () => ({
  ...jest.requireActual("@/lib/local-image-storage"),
  deleteLocalImage: jest.fn(),
}));

import { BlobNotFoundError, del } from "@vercel/blob";
import { BlobDeletionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanupUncommittedBlobUploads, enqueueBlobDeletions, processBlobDeletionQueue } from "./blob-cleanup";
import { deleteLocalImage } from "./local-image-storage";

const mockDel = del as jest.Mock;
const mockLocalDelete = deleteLocalImage as jest.Mock;
const localReference = "sultan-local://orders/12345678-1234-4123-8123-123456789abc.png";
const mockPrisma = prisma as unknown as {
  blobDeletion: { findMany: jest.Mock; delete: jest.Mock; update: jest.Mock; upsert: jest.Mock };
  order: { count: jest.Mock };
  $transaction: jest.Mock;
};
const privateUrl = "https://store.private.blob.vercel-storage.com/orders/a.png";
const publicUrl = "https://store.public.blob.vercel-storage.com/orders/a.png";
const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
const originalLegacyToken = process.env.BLOB_LEGACY_PUBLIC_READ_WRITE_TOKEN;

function deletionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "deletion-1",
    url: privateUrl,
    attempts: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    nextAttemptAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-private-token";
  delete process.env.BLOB_LEGACY_PUBLIC_READ_WRITE_TOKEN;
  mockPrisma.blobDeletion.findMany.mockResolvedValue([deletionRecord()]);
  mockPrisma.blobDeletion.delete.mockResolvedValue({});
  mockPrisma.blobDeletion.update.mockResolvedValue({});
  mockPrisma.blobDeletion.upsert.mockResolvedValue({});
  mockPrisma.order.count.mockResolvedValue(0);
  mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma));
  mockDel.mockResolvedValue(undefined);
  mockLocalDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  if (originalLegacyToken === undefined) delete process.env.BLOB_LEGACY_PUBLIC_READ_WRITE_TOKEN;
  else process.env.BLOB_LEGACY_PUBLIC_READ_WRITE_TOKEN = originalLegacyToken;
  jest.useRealTimers();
});

describe("enqueueBlobDeletions", () => {
  it("deduplicates supported URLs and excludes unsupported URLs", async () => {
    const tx = {
      blobDeletion: {
        upsert: jest.fn().mockResolvedValue({ id: "deletion-1" }),
        findMany: jest.fn().mockResolvedValue([{ id: "deletion-1" }]),
      },
    };

    const result = await enqueueBlobDeletions(
      tx as never,
      [privateUrl, privateUrl, "https://evil.example/orders/b.png"],
      "order-1",
    );

    expect(tx.blobDeletion.upsert).toHaveBeenCalledTimes(1);
    expect(tx.blobDeletion.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { url: privateUrl },
      create: { url: privateUrl, sourceOrderId: "order-1" },
    }));
    expect(result).toEqual({ ids: ["deletion-1"], unsupportedCount: 1 });
  });
});

describe("processBlobDeletionQueue", () => {
  it("deletes a private local image without a provider token", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    mockPrisma.blobDeletion.findMany.mockResolvedValue([deletionRecord({ url: localReference })]);
    expect(await processBlobDeletionQueue()).toEqual({ processed: 1, deleted: 1, deferred: 0, failed: 0 });
    expect(mockLocalDelete).toHaveBeenCalledWith(localReference);
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("retains a referenced local image instead of deleting it", async () => {
    mockPrisma.blobDeletion.findMany.mockResolvedValue([deletionRecord({ url: localReference })]);
    mockPrisma.order.count.mockResolvedValue(1);
    expect((await processBlobDeletionQueue()).deferred).toBe(1);
    expect(mockLocalDelete).not.toHaveBeenCalled();
  });

  it("persists a retry when local file deletion fails", async () => {
    mockPrisma.blobDeletion.findMany.mockResolvedValue([deletionRecord({ url: localReference })]);
    mockLocalDelete.mockRejectedValueOnce(new Error("disk error with internal details"));
    expect((await processBlobDeletionQueue()).failed).toBe(1);
    expect(mockPrisma.blobDeletion.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ attempts: 1, lastError: "BLOB_DELETE_FAILED" }),
    }));
  });
  it("deletes an unreferenced private image with the private token", async () => {
    const result = await processBlobDeletionQueue({ ids: ["deletion-1"] });

    expect(mockDel).toHaveBeenCalledWith(privateUrl, { token: "test-private-token" });
    expect(mockPrisma.blobDeletion.delete).toHaveBeenCalledWith({ where: { id: "deletion-1" } });
    expect(result).toEqual({ processed: 1, deleted: 1, deferred: 0, failed: 0 });
  });

  it("treats a provider not-found response as an idempotent deletion", async () => {
    mockDel.mockRejectedValue(new BlobNotFoundError());

    const result = await processBlobDeletionQueue();

    expect(mockPrisma.blobDeletion.delete).toHaveBeenCalledWith({ where: { id: "deletion-1" } });
    expect(result.deleted).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("keeps a still-referenced image and removes its stale queue entry", async () => {
    mockPrisma.order.count.mockResolvedValue(1);

    const result = await processBlobDeletionQueue();

    expect(mockPrisma.blobDeletion.delete).toHaveBeenCalledWith({ where: { id: "deletion-1" } });
    expect(mockDel).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 1, deleted: 0, deferred: 1, failed: 0 });
  });

  it("moves a missing-token deletion to attention without calling the provider", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const result = await processBlobDeletionQueue();

    expect(mockDel).not.toHaveBeenCalled();
    expect(mockPrisma.blobDeletion.update).toHaveBeenCalledWith({
      where: { id: "deletion-1" },
      data: expect.objectContaining({
        status: BlobDeletionStatus.NEEDS_ATTENTION,
        lastError: "STORE_TOKEN_MISSING",
        nextAttemptAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      }),
    });
    expect(result.failed).toBe(1);
  });

  it("records only a generic error and schedules retry after a provider failure", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);
    mockDel.mockRejectedValue(new Error("provider response leaked detail"));

    const result = await processBlobDeletionQueue();

    expect(mockPrisma.blobDeletion.update).toHaveBeenCalledWith({
      where: { id: "deletion-1" },
      data: expect.objectContaining({
        attempts: 1,
        status: BlobDeletionStatus.PENDING,
        lastError: "BLOB_DELETE_FAILED",
        nextAttemptAt: new Date(now.getTime() + 60_000),
      }),
    });
    expect(JSON.stringify(mockPrisma.blobDeletion.update.mock.calls)).not.toContain("provider response leaked detail");
    expect(result.failed).toBe(1);
  });

  it("escalates the eighth failed attempt to manual attention", async () => {
    mockPrisma.blobDeletion.findMany.mockResolvedValue([deletionRecord({ attempts: 7 })]);
    mockDel.mockRejectedValue(new Error("provider unavailable"));

    await processBlobDeletionQueue();

    expect(mockPrisma.blobDeletion.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "deletion-1" },
      data: expect.objectContaining({ attempts: 8, status: BlobDeletionStatus.NEEDS_ATTENTION }),
    }));
  });

  it("uses the legacy token only for public blobs", async () => {
    mockPrisma.blobDeletion.findMany.mockResolvedValue([deletionRecord({ url: publicUrl })]);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_LEGACY_PUBLIC_READ_WRITE_TOKEN = "test-legacy-token";

    await processBlobDeletionQueue();

    expect(mockDel).toHaveBeenCalledWith(publicUrl, { token: "test-legacy-token" });
  });

  it("marks unsupported stored URLs for attention without calling the provider", async () => {
    mockPrisma.blobDeletion.findMany.mockResolvedValue([deletionRecord({ url: "https://evil.example/orders/a.png" })]);

    const result = await processBlobDeletionQueue();

    expect(mockDel).not.toHaveBeenCalled();
    expect(mockPrisma.blobDeletion.update).toHaveBeenCalledWith({
      where: { id: "deletion-1" },
      data: { status: BlobDeletionStatus.NEEDS_ATTENTION, lastError: "UNSUPPORTED_BLOB_URL" },
    });
    expect(result.failed).toBe(1);
  });
});

describe("cleanupUncommittedBlobUploads", () => {
  it("persists cleanup before immediately deleting uncommitted uploads", async () => {
    mockPrisma.blobDeletion.findMany
      .mockResolvedValueOnce([{ id: "deletion-1" }])
      .mockResolvedValueOnce([deletionRecord()]);

    const result = await cleanupUncommittedBlobUploads([privateUrl], "order-1");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.blobDeletion.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { url: privateUrl },
      create: { url: privateUrl, sourceOrderId: "order-1" },
    }));
    expect(mockDel).toHaveBeenCalledWith(privateUrl, { token: "test-private-token" });
    expect(result).toEqual({ processed: 1, deleted: 1, deferred: 0, failed: 0, unsupportedCount: 0 });
  });

  it("keeps a retryable database job when immediate provider deletion fails", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);
    mockPrisma.blobDeletion.findMany
      .mockResolvedValueOnce([{ id: "deletion-1" }])
      .mockResolvedValueOnce([deletionRecord()]);
    mockDel.mockRejectedValue(new Error("temporary provider outage"));

    const result = await cleanupUncommittedBlobUploads([privateUrl]);

    expect(mockPrisma.blobDeletion.update).toHaveBeenCalledWith({
      where: { id: "deletion-1" },
      data: expect.objectContaining({
        attempts: 1,
        status: BlobDeletionStatus.PENDING,
        lastError: "BLOB_DELETE_FAILED",
        nextAttemptAt: new Date(now.getTime() + 60_000),
      }),
    });
    expect(result.failed).toBe(1);
  });
});
