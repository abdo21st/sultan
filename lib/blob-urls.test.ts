import { blobDeletionRetryDelayMs, classifyVercelBlobUrl } from "./blob-urls";

describe("classifyVercelBlobUrl", () => {
  it("accepts HTTPS Vercel private and public blob URLs", () => {
    expect(classifyVercelBlobUrl("https://store.private.blob.vercel-storage.com/orders/a.png")).toBe("private");
    expect(classifyVercelBlobUrl("https://store.public.blob.vercel-storage.com/orders/a.png")).toBe("public");
  });

  it.each([
    "http://store.private.blob.vercel-storage.com/orders/a.png",
    "https://vercel-storage.com/orders/a.png",
    "https://store.private.blob.vercel-storage.com.evil.example/orders/a.png",
    "https://user:secret@store.private.blob.vercel-storage.com/orders/a.png",
    "https://store.private.blob.vercel-storage.com/orders/a.png?token=x",
    "https://store.private.blob.vercel-storage.com/",
    "not-a-url",
  ])("rejects non-canonical or unsupported URL %s", (value) => {
    expect(classifyVercelBlobUrl(value)).toBeNull();
  });
});

describe("blobDeletionRetryDelayMs", () => {
  it("backs off exponentially and caps the delay at one day", () => {
    expect(blobDeletionRetryDelayMs(0)).toBe(30_000);
    expect(blobDeletionRetryDelayMs(1)).toBe(60_000);
    expect(blobDeletionRetryDelayMs(30)).toBe(24 * 60 * 60 * 1000);
  });
});
