import { put } from '@vercel/blob';

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function saveFile(file: File, prefix: string = "file"): Promise<string | null> {
    if (file.size === 0) return null;

    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`الملف ${file.name} كبير جداً. الحد الأقصى هو 5 ميجابايت.`);
    }

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) && !file.type.startsWith('image/')) {
        throw new Error(`نوع الملف غير مسموح به. المسموح: الصور فقط (${ALLOWED_EXTENSIONS.join(", ")})`);
    }

    try {
        console.log(`[saveFile] Uploading to Vercel Blob: ${file.name}...`);

        // Upload to Vercel Blob
        const blob = await put(`orders/${prefix}-${Date.now()}-${file.name}`, file, {
            access: 'public', // Change to 'private' if needed, but public is standard for served images
        });

        console.log("[saveFile] Vercel Blob SUCCESS:", blob.url);
        return blob.url;
    } catch (err: any) {
        console.error("[saveFile] Vercel Blob Error:", err);
        throw new Error(`حدث خطأ أثناء رفع الصورة إلى Vercel Blob: ${err.message || "خطأ مجهول"}`);
    }
}
