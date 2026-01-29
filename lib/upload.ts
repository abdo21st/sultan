import { v2 as cloudinary } from 'cloudinary';

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Gets and cleans Cloudinary credentials from environment variables
 */
const getCloudinaryConfig = () => {
    const clean = (val: string | undefined) => val ? val.replace(/['"\r\n\t\s]/g, '').trim() : '';

    const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
    const apiKey = clean(process.env.CLOUDINARY_API_KEY);
    const apiSecret = clean(process.env.CLOUDINARY_API_SECRET);

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("إعدادات Cloudinary غير مكتملة في ملف .env");
    }

    return { cloudName, apiKey, apiSecret };
};

export async function saveFile(file: File, prefix: string = "file"): Promise<string | null> {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

    if (file.size === 0) return null;

    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`الملف ${file.name} كبير جداً. الحد الأقصى هو 5 ميجابايت.`);
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = `data:${file.type};base64,${buffer.toString('base64')}`;

        console.log(`[saveFile] Final attempt: Uploading with direct config for ${file.name}`);

        // 🚀 هذه هي الصياغة الوحيدة التي نجحت في الاختبارات السابقة
        const result = await cloudinary.uploader.upload(base64Image, {
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
            folder: 'sultan/orders',
            resource_type: 'auto'
        });

        console.log("[saveFile] SUCCESS!", result.secure_url);
        return result.secure_url;
    } catch (err: any) {
        console.error("[saveFile] Error Details:", err);
        throw new Error(`خطأ الرفع: ${err.message || "فشل التوقيع الرقمي"}`);
    }
}
