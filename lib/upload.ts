import path from "path";
import { writeFile, mkdir } from "fs/promises";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function saveFile(file: File, prefix: string = "file"): Promise<string | null> {
    if (file.size === 0) return null;
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`الملف ${file.name} كبير جداً. الحد الأقصى هو 5 ميجابايت.`);
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new Error(`نوع الملف ${ext} غير مسموح به. المسموح: ${ALLOWED_EXTENSIONS.join(", ")}`);
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // Sanitize filename: remove special characters and add timestamp + random string
    const safeName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
    const fullPath = path.join(uploadDir, safeName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);

    return `/uploads/${safeName}`;
}
