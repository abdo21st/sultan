import { put } from '@vercel/blob';

const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB (Vercel limit for Hobby)

export async function saveFile(file: File, prefix: string = "file"): Promise<string | null> {
    if (file.size === 0) return null;

    // تأكد من وجود التوكن
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
        console.error("[saveFile] ERROR: BLOB_READ_WRITE_TOKEN is missing from environment variables!");
        throw new Error("لم يتم العثور على مفتاح التفعيل (Token). تأكد من وجوده في ملف .env وإعادة تشغيل السيرفر.");
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`المجف ${file.name} كبير جداً. الحد الأقصى لخطة Vercel المجانية هو 4.5 ميجابايت.`);
    }

    try {
        console.log(`[saveFile] Uploading to Vercel Blob: ${file.name}...`);

        const blob = await put(`orders/${prefix}-${Date.now()}-${file.name}`, file, {
            access: 'public',
            token: token // نمرر التوكن بشكل صريح للتأكد
        });

        console.log("[saveFile] Vercel Blob SUCCESS:", blob.url);
        return blob.url;
    } catch (error: unknown) {
        const err = error as Error;
        console.error("[saveFile] Vercel Blob Detailed Error:", err);
        throw new Error(`حدث خطأ أثناء رفع الصورة: ${err.message}`);
    }
}
