import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary function
const configureCloudinary = () => {
    const clean = (val: string | undefined) => val?.replace(/['"]/g, '').trim();

    const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
    const apiKey = clean(process.env.CLOUDINARY_API_KEY);
    const apiSecret = clean(process.env.CLOUDINARY_API_SECRET);

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("إعدادات Cloudinary غير مكتملة. تأكد من وجود المتغيرات في ملف .env وإعادة تشغيل السيرفر.");
    }

    // Debug log (Safe: only shows first and last chars)
    console.log(`[Cloudinary Config] Cloud: ${cloudName}, Key: ${apiKey?.substring(0, 4)}..., Secret: ${apiSecret?.substring(0, 2)}***${apiSecret?.substring(apiSecret.length - 2)}`);

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });
};

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function saveFile(file: File, prefix: string = "file"): Promise<string | null> {
    configureCloudinary();

    if (file.size === 0) return null;

    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`الملف ${file.name} كبير جداً. الحد الأقصى هو 5 ميجابايت.`);
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = `data:${file.type};base64,${buffer.toString('base64')}`;

        console.log(`[saveFile] Uploading to Cloudinary (Base64)...`);

        const result = await cloudinary.uploader.upload(base64Image, {
            folder: 'sultan/orders',
            public_id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            resource_type: 'auto',
        });

        console.log("[saveFile] Upload Success:", result.secure_url);
        return result.secure_url;
    } catch (err: any) {
        console.error("[saveFile] Cloudinary Error:", err);
        throw new Error(`حدث خطأ أثناء رفع الصورة: ${err.message || "خطأ مجهول"}`);
    }
}
