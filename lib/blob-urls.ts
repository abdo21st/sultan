export type VercelBlobAccess = "private" | "public";

export function classifyVercelBlobUrl(value: string): VercelBlobAccess | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
    if (!url.pathname || url.pathname === "/") return null;
    if (url.hostname.endsWith(".private.blob.vercel-storage.com")) return "private";
    if (url.hostname.endsWith(".public.blob.vercel-storage.com")) return "public";
  } catch {
    return null;
  }
  return null;
}

export function blobDeletionRetryDelayMs(attempts: number): number {
  const safeAttempts = Math.max(0, Math.min(Math.floor(attempts), 12));
  return Math.min(24 * 60 * 60 * 1000, 30_000 * 2 ** safeAttempts);
}
