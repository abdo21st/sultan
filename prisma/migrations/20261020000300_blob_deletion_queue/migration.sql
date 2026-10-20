BEGIN;

CREATE TYPE "BlobDeletionStatus" AS ENUM ('PENDING', 'NEEDS_ATTENTION');

CREATE TABLE "BlobDeletion" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceOrderId" TEXT,
    "status" "BlobDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BlobDeletion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BlobDeletion_attempts_nonnegative_check" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "BlobDeletion_url_key" ON "BlobDeletion"("url");
CREATE INDEX "BlobDeletion_status_nextAttemptAt_createdAt_idx" ON "BlobDeletion"("status", "nextAttemptAt", "createdAt");

COMMIT;
