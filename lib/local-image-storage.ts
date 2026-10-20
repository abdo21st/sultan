import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const imageTypes = { jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" } as const;
const referencePattern = /^sultan-local:\/\/orders\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.(jpg|png|gif|webp)$/;
const maxBytes = 4.5 * 1024 * 1024;

export function parseLocalImageReference(reference: string) {
  const match = referencePattern.exec(reference);
  if (!match) return null;
  const extension = match[2] as keyof typeof imageTypes;
  return { fileName: `${match[1]}.${extension}`, contentType: imageTypes[extension] };
}

function storageDirectory() {
  const configured = process.env.ORDER_IMAGE_STORAGE_DIR || join(process.cwd(), "storage", "order-images");
  if (!isAbsolute(configured)) throw new Error("Image storage directory must be absolute.");
  const root = resolve(/* turbopackIgnore: true */ configured);
  for (const publicDirectory of [resolve("public"), resolve(".next/static")]) {
    const child = relative(publicDirectory, root);
    if (child === "" || (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child))) {
      throw new Error("Image storage must be outside publicly served directories.");
    }
  }
  return root;
}

export async function saveLocalImage(file: File): Promise<string> {
  const extension = (Object.keys(imageTypes) as Array<keyof typeof imageTypes>).find((key) => imageTypes[key] === file.type);
  if (!extension || file.size <= 0 || file.size > maxBytes) throw new Error("Invalid local image.");
  const root = storageDirectory();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const fileName = `${randomUUID()}.${extension}`;
  const target = join(/* turbopackIgnore: true */ root, fileName);
  const handle = await open(/* turbopackIgnore: true */ target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size || bytes.byteLength > maxBytes) throw new Error("Image size changed during upload.");
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(/* turbopackIgnore: true */ target).catch(() => undefined);
    throw error;
  } finally {
    await handle.close().catch(() => undefined);
  }
  return `sultan-local://orders/${fileName}`;
}

export async function readLocalImage(reference: string) {
  const parsed = parseLocalImageReference(reference);
  if (!parsed) return null;
  const target = join(/* turbopackIgnore: true */ storageDirectory(), parsed.fileName);
  try {
    const metadata = await lstat(/* turbopackIgnore: true */ target);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size <= 0 || metadata.size > maxBytes) return null;
    const handle = await open(/* turbopackIgnore: true */ target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const bytes = await handle.readFile();
      if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) return null;
      return {
        data: new Uint8Array(bytes),
        contentType: parsed.contentType,
        etag: `"${createHash("sha256").update(bytes).digest("hex")}"`,
      };
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (["ENOENT", "ELOOP"].includes((error as NodeJS.ErrnoException).code || "")) return null;
    throw error;
  }
}

export async function deleteLocalImage(reference: string) {
  const parsed = parseLocalImageReference(reference);
  if (!parsed) throw new Error("Invalid local image reference.");
  try {
    // unlink removes a directory entry and never follows a symbolic link.
    await unlink(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ storageDirectory(), parsed.fileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
