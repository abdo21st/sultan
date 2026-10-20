import { randomUUID } from 'node:crypto'
import { put } from '@vercel/blob'
import { saveLocalImage } from './local-image-storage'

const MAX_FILE_SIZE = 4.5 * 1024 * 1024
const IMAGE_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
    'image/jpeg': (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    'image/png': (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
    'image/gif': (bytes) => bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46,
    'image/webp': (bytes) => bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50,
}

async function isSupportedImage(file: File) {
    const validate = IMAGE_SIGNATURES[file.type]
    if (!validate) return false
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    return validate(bytes)
}

export async function saveFile(file: File, prefix = 'order'): Promise<string | null> {
    if (file.size === 0) return null
    if (file.size > MAX_FILE_SIZE) throw new Error('حجم الصورة يتجاوز الحد المسموح.')
    if (!(await isSupportedImage(file))) throw new Error('نوع الصورة غير مدعوم.')

    if (process.env.ORDER_IMAGE_STORAGE === 'local') {
        try {
            return await saveLocalImage(file)
        } catch (error) {
            throw new Error('تعذر حفظ الصورة، حاول مرة أخرى.', { cause: error })
        }
    }
    if (process.env.ORDER_IMAGE_STORAGE && process.env.ORDER_IMAGE_STORAGE !== 'vercel') {
        throw new Error('تخزين الصور غير مهيأ.')
    }
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) throw new Error('تخزين الصور غير مهيأ.')

    const safePrefix = prefix.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'order'
    try {
        const blob = await put(`orders/${safePrefix}-${randomUUID()}`, file, {
            access: 'private',
            contentType: file.type,
            token,
        })
        return blob.url
    } catch (error) {
        throw new Error('تعذر رفع الصورة، حاول مرة أخرى.', { cause: error })
    }
}
