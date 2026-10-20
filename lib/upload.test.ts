jest.mock("@vercel/blob", () => ({ put: jest.fn() }));

import { put } from "@vercel/blob";
import { saveFile } from "./upload";

const mockPut = put as jest.Mock;
const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

function fakeImage(type: string, bytes: number[], size = bytes.length): File {
  return {
    type,
    size,
    slice: jest.fn(() => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer })),
  } as unknown as File;
}

afterEach(() => {
  if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  jest.clearAllMocks();
});

describe("saveFile", () => {
  it("uploads a validated image to private storage with a sanitized path", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
    const file = fakeImage("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    mockPut.mockResolvedValue({ url: "https://store.private.blob.vercel-storage.com/orders/order2026-a.png" });

    const result = await saveFile(file, "order:2026");

    expect(result).toBe("https://store.private.blob.vercel-storage.com/orders/order2026-a.png");
    expect(mockPut).toHaveBeenCalledWith(expect.stringMatching(/^orders\/order2026-/), file, {
      access: "private",
      contentType: "image/png",
      token: "test-blob-token",
    });
  });

  it("returns null for an empty file without calling the provider", async () => {
    expect(await saveFile(fakeImage("image/png", [], 0))).toBeNull();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("rejects unsupported media types and invalid file signatures before upload", async () => {
    await expect(saveFile(fakeImage("image/svg+xml", [0x3c, 0x73, 0x76, 0x67]))).rejects.toThrow("نوع الصورة غير مدعوم.");
    await expect(saveFile(fakeImage("image/png", [0x00, 0x00, 0x00, 0x00]))).rejects.toThrow("نوع الصورة غير مدعوم.");
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("rejects files over the configured size limit before upload", async () => {
    await expect(saveFile(fakeImage("image/jpeg", [0xff, 0xd8, 0xff], 4.5 * 1024 * 1024 + 1))).rejects.toThrow("حجم الصورة يتجاوز الحد المسموح.");
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("requires a configured private-store token", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    await expect(saveFile(fakeImage("image/jpeg", [0xff, 0xd8, 0xff]))).rejects.toThrow("تخزين الصور غير مهيأ.");
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("returns a safe message when the provider rejects an upload", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
    const providerError = new Error("provider diagnostic with secret details");
    mockPut.mockRejectedValue(providerError);

    await expect(saveFile(fakeImage("image/jpeg", [0xff, 0xd8, 0xff]))).rejects.toMatchObject({
      message: "تعذر رفع الصورة، حاول مرة أخرى.",
      cause: providerError,
    });
  });
});
