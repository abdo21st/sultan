import path from "path";
import { writeFile, mkdir } from "fs/promises";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function saveFile(file: File, prefix: string = "file"): Promise<string | null> {
    console.log(`[saveFile] Starting upload for ${file.name}, size: ${file.size}, type: ${file.type}`);
    if (file.size === 0) {
        console.log("[saveFile] File size is 0, skipping");
        return null;
    }
    if (file.size > MAX_FILE_SIZE) {
        console.error(`[saveFile] File too large: ${file.size}`);
        throw new Error(`الملف ${file.name} كبير جداً. الحد الأقصى هو 5 ميجابايت.`);
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        console.error(`[saveFile] Invalid extension: ${ext}`);
        throw new Error(`نوع الملف ${ext} غير مسموح به. المسموح: ${ALLOWED_EXTENSIONS.join(", ")}`);
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // Sanitize filename: remove special characters and add timestamp + random string
    const safeName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
    const fullPath = path.join(uploadDir, safeName);
    console.log(`[saveFile] Saving to path: ${fullPath}`);

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(fullPath, buffer);
        console.log(`[saveFile] Successfully saved: ${safeName}`);
    } catch (err) {
        console.error("[saveFile] Error writing file:", err);
        throw err;
    }

    return `/uploads/${safeName}`;
}
