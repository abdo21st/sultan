import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function saveFile(file: File, prefix: string = "file"): Promise<string | null> {
    console.log(`[saveFile] Starting Cloudinary upload for ${file.name}, size: ${file.size}, type: ${file.type}`);

    if (file.size === 0) {
        console.log("[saveFile] File size is 0, skipping");
        return null;
    }

    if (file.size > MAX_FILE_SIZE) {
        console.error(`[saveFile] File too large: ${file.size}`);
        throw new Error(`الملف ${file.name} كبير جداً. الحد الأقصى هو 5 ميجابايت.`);
    }

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) && !file.type.startsWith('image/')) {
        console.error(`[saveFile] Invalid type: ${file.type} or extension: ${ext}`);
        throw new Error(`نوع الملف غير مسموح به. المسموح: الصور فقط (${ALLOWED_EXTENSIONS.join(", ")})`);
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'sultan/orders',
                    public_id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    resource_type: 'auto',
                },
                (error, result) => {
                    if (error) {
                        console.error("[saveFile] Cloudinary Upload Error:", error);
                        reject(new Error(`حدث خطأ أثناء رفع الصورة: ${error.message}`));
                    } else {
                        console.log("[saveFile] Uploaded successfully:", result?.secure_url);
                        resolve(result?.secure_url || null);
                    }
                }
            );

            uploadStream.end(buffer);
        });
    } catch (err) {
        console.error("[saveFile] Unexpected error:", err);
        throw err;
    }
}
