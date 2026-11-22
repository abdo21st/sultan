export const MAX_ORDER_IMAGE_SIZE = 4.5 * 1024 * 1024;
export const MAX_NEW_ORDER_IMAGES = 3;
export const MAX_ORDER_REQUEST_BYTES = 16 * 1024 * 1024;

export function isOversizedOrderContentLength(rawLength: string | null): boolean {
    if (!rawLength || !/^\d+$/.test(rawLength)) return false;
    return Number(rawLength) > MAX_ORDER_REQUEST_BYTES;
}
