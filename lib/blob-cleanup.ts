import { BlobNotFoundError, del } from "@vercel/blob";
import { BlobDeletionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { blobDeletionRetryDelayMs, classifyVercelBlobUrl } from "@/lib/blob-urls";
import { deleteLocalImage, parseLocalImageReference } from "@/lib/local-image-storage";

type TransactionClient = Prisma.TransactionClient;

export async function enqueueBlobDeletions(
  tx: TransactionClient,
  urls: string[],
  sourceOrderId: string | null = null,
) {
  const uniqueUrls = [...new Set(urls)];
  const supportedUrls = uniqueUrls.filter((url) => classifyVercelBlobUrl(url) !== null || parseLocalImageReference(url) !== null);
  const unsupportedCount = uniqueUrls.length - supportedUrls.length;

  for (const url of supportedUrls) {
    await tx.blobDeletion.upsert({
      where: { url },
      create: { url, sourceOrderId },
      update: {
        sourceOrderId,
        status: BlobDeletionStatus.PENDING,
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      },
    });
  }

  if (supportedUrls.length === 0) return { ids: [], unsupportedCount };
  const pending = await tx.blobDeletion.findMany({
    where: { url: { in: supportedUrls } },
    select: { id: true },
  });
  return { ids: pending.map(({ id }) => id), unsupportedCount };
}

export async function cleanupUncommittedBlobUploads(urls: string[], sourceOrderId: string | null = null) {
  const queued = await prisma.$transaction((tx) => enqueueBlobDeletions(tx, urls, sourceOrderId));
  const result = queued.ids.length > 0
    ? await processBlobDeletionQueue({ ids: queued.ids })
    : { processed: 0, deleted: 0, deferred: 0, failed: 0 };
  return { ...result, unsupportedCount: queued.unsupportedCount };
}

export async function processBlobDeletionQueue(options: { ids?: string[]; limit?: number } = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const now = new Date();
  const records = await prisma.blobDeletion.findMany({
    where: {
      nextAttemptAt: { lte: now },
      status: { in: [BlobDeletionStatus.PENDING, BlobDeletionStatus.NEEDS_ATTENTION] },
      ...(options.ids ? { id: { in: options.ids } } : {}),
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  let deleted = 0;
  let deferred = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const stillReferenced = await prisma.order.count({ where: { images: { has: record.url } } });
      if (stillReferenced > 0) {
        await prisma.blobDeletion.delete({ where: { id: record.id } });
        deferred += 1;
        continue;
      }

      if (parseLocalImageReference(record.url)) {
        await deleteLocalImage(record.url);
        await prisma.blobDeletion.delete({ where: { id: record.id } });
        deleted += 1;
        continue;
      }

      const access = classifyVercelBlobUrl(record.url);
      if (!access) {
        await prisma.blobDeletion.update({
          where: { id: record.id },
          data: { status: BlobDeletionStatus.NEEDS_ATTENTION, lastError: "UNSUPPORTED_BLOB_URL" },
        });
        failed += 1;
        continue;
      }

      const token = access === "private"
        ? process.env.BLOB_READ_WRITE_TOKEN
        : process.env.BLOB_LEGACY_PUBLIC_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        await prisma.blobDeletion.update({
          where: { id: record.id },
          data: {
            status: BlobDeletionStatus.NEEDS_ATTENTION,
            lastError: "STORE_TOKEN_MISSING",
            nextAttemptAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        failed += 1;
        continue;
      }

      try {
        await del(record.url, { token });
      } catch (error) {
        if (!(error instanceof BlobNotFoundError)) throw error;
      }
      await prisma.blobDeletion.delete({ where: { id: record.id } });
      deleted += 1;
    } catch {
      const attempts = record.attempts + 1;
      await prisma.blobDeletion.update({
        where: { id: record.id },
        data: {
          attempts,
          status: attempts >= 8 ? BlobDeletionStatus.NEEDS_ATTENTION : BlobDeletionStatus.PENDING,
          nextAttemptAt: new Date(Date.now() + blobDeletionRetryDelayMs(attempts)),
          lastError: "BLOB_DELETE_FAILED",
        },
      }).catch(() => undefined);
      failed += 1;
    }
  }

  return { processed: records.length, deleted, deferred, failed };
}
