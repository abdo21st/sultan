/** @jest-environment node */
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { deleteLocalImage, parseLocalImageReference, readLocalImage, saveLocalImage } from "./local-image-storage";
import { saveFile } from "./upload";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=", "base64");
const originalRoot = process.env.ORDER_IMAGE_STORAGE_DIR;
const originalProvider = process.env.ORDER_IMAGE_STORAGE;
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "sultan-images-test-"));
  process.env.ORDER_IMAGE_STORAGE_DIR = join(directory, "private");
  process.env.ORDER_IMAGE_STORAGE = "local";
});

afterEach(async () => {
  if (originalRoot === undefined) delete process.env.ORDER_IMAGE_STORAGE_DIR;
  else process.env.ORDER_IMAGE_STORAGE_DIR = originalRoot;
  if (originalProvider === undefined) delete process.env.ORDER_IMAGE_STORAGE;
  else process.env.ORDER_IMAGE_STORAGE = originalProvider;
  await rm(directory, { recursive: true, force: true });
});

it("persists image bytes privately and reads them through an opaque reference", async () => {
  const reference = await saveFile(new File([png], "../../customer.png", { type: "image/png" }));
  expect(reference).toMatch(/^sultan-local:\/\/orders\/[a-f0-9-]+\.png$/);
  const parsed = parseLocalImageReference(reference!)!;
  const saved = await readLocalImage(reference!);
  expect(Buffer.from(saved!.data)).toEqual(png);
  expect(saved!.contentType).toBe("image/png");
  expect(saved!.etag).toMatch(/^"[a-f0-9]{64}"$/);
  const diskFile = join(process.env.ORDER_IMAGE_STORAGE_DIR!, parsed.fileName);
  expect(await readFile(diskFile)).toEqual(png);
  if (process.platform !== "win32") expect((await stat(diskFile)).mode & 0o777).toBe(0o600);
});

it.each([
  "../../.env", "/etc/passwd", "sultan-local://orders/../../.env",
  "sultan-local://orders/12345678-1234-4123-8123-123456789abc.png?file=.env",
  "sultan-local://orders/%2e%2e%2fsecret.png", "sultan-local://other/12345678-1234-4123-8123-123456789abc.png",
])("rejects an untrusted file reference: %s", async (reference) => {
  expect(parseLocalImageReference(reference)).toBeNull();
  expect(await readLocalImage(reference)).toBeNull();
  await expect(deleteLocalImage(reference)).rejects.toThrow("Invalid local image reference.");
});

it("deletes the selected image idempotently while retaining another image", async () => {
  const first = await saveLocalImage(new File([png], "a.png", { type: "image/png" }));
  const second = await saveLocalImage(new File([png], "b.png", { type: "image/png" }));
  await deleteLocalImage(first);
  await deleteLocalImage(first);
  expect(await readLocalImage(first)).toBeNull();
  expect(await readLocalImage(second)).not.toBeNull();
});

(process.platform === "win32" ? it.skip : it)("refuses to serve a symbolic link and never deletes its target", async () => {
  const reference = await saveLocalImage(new File([png], "safe.png", { type: "image/png" }));
  const fileName = parseLocalImageReference(reference)!.fileName;
  await deleteLocalImage(reference);
  const outside = join(directory, "secret");
  await writeFile(outside, "private sentinel");
  await symlink(outside, join(process.env.ORDER_IMAGE_STORAGE_DIR!, fileName));
  expect(await readLocalImage(reference)).toBeNull();
  await deleteLocalImage(reference);
  expect(await readFile(outside, "utf8")).toBe("private sentinel");
});

it.each(["uploads", "..hidden"])("rejects storage beneath a public directory: %s", async (subdirectory) => {
  process.env.ORDER_IMAGE_STORAGE_DIR = resolve("public", subdirectory);
  await expect(saveLocalImage(new File([png], "a.png", { type: "image/png" }))).rejects.toThrow("outside publicly served directories");
});

it("does not write an invalid image through the public upload function", async () => {
  await expect(saveFile(new File(["not an image"], "bad.png", { type: "image/png" }))).rejects.toThrow("نوع الصورة غير مدعوم.");
});
