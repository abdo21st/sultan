import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { BlobNotFoundError, del, head, list } from "@vercel/blob";
import { classifyVercelBlobUrl } from "../lib/blob-urls";
import { saveFile } from "../lib/upload";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is required.");

  const prefix = `probe${randomUUID().replace(/-/g, "")}`;
  const pathnamePrefix = `orders/${prefix}-`;
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const file = new File([bytes], `sultan-blob-smoke-${randomUUID()}.png`, { type: "image/png" });
  let url: string | null = null;
  let deleted = false;

  try {
    url = await saveFile(file, prefix);
    if (!url || classifyVercelBlobUrl(url) !== "private") {
      throw new Error("Upload did not return a private Vercel Blob URL.");
    }

    const uploaded = await head(url, { token });
    if (uploaded.contentType !== "image/png" || uploaded.size !== bytes.byteLength) {
      throw new Error("Uploaded blob metadata did not match the probe file.");
    }

    await del(url, { token });
    deleted = true;

    let confirmedAbsent = false;
    try {
      await head(url, { token });
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
      confirmedAbsent = true;
    }
    if (!confirmedAbsent) throw new Error("Deleted blob remained available to metadata lookup.");

    console.log("Private Vercel Blob upload, metadata lookup, delete, and absence check passed.");
  } catch (error) {
    let cleanupConfirmed = false;
    try {
      if (url && !deleted) await del(url, { token });
      const remaining = await list({ prefix: pathnamePrefix, limit: 10, token });
      if (remaining.blobs.length > 0) {
        await del(remaining.blobs.map((blob) => blob.url), { token });
      }
      const check = await list({ prefix: pathnamePrefix, limit: 10, token });
      cleanupConfirmed = check.blobs.length === 0 && !check.hasMore;
    } catch {
      cleanupConfirmed = false;
    }

    const diagnostic = error instanceof Error ? error.cause : error;
    const details = diagnostic && typeof diagnostic === "object"
      ? diagnostic as { name?: unknown; status?: unknown; code?: unknown }
      : {};
    const name = typeof details.name === "string" ? details.name : "UnknownError";
    const status = typeof details.status === "number" ? `, HTTP ${details.status}` : "";
    const code = typeof details.code === "string" ? `, ${details.code}` : "";
    const message = diagnostic instanceof Error
      ? diagnostic.message
          .replaceAll(token, "[REDACTED]")
          .replace(/https?:\/\/\S+/gi, "[URL]")
          .replace(/(?:bearer|authorization)\s+\S+/gi, "$1 [REDACTED]")
          .replace(/[A-Za-z0-9_-]{40,}/g, "[REDACTED]")
          .replace(/\s+/g, " ")
          .slice(0, 200)
      : "";
    console.error(`Private Vercel Blob acceptance failed (${name}${status}${code})${message ? `: ${message}` : "."}`);
    console.error(cleanupConfirmed
      ? "The unique smoke-test prefix was checked and is empty."
      : "Cleanup could not be confirmed; inspect the unique smoke-test prefix in the private store.");
    process.exitCode = cleanupConfirmed ? 1 : 2;
  }
}

main().catch(() => {
  console.error("Private Vercel Blob acceptance could not start.");
  process.exitCode = 1;
});
