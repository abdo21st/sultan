import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

function getSecret() {
    const secret = process.env.ORDER_SHARE_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret || secret.length < 32) throw new Error("A 32-character AUTH_SECRET or ORDER_SHARE_SECRET is required for share links.");
    return secret;
}

function sign(payload: string) {
    return createHmac("sha256", getSecret()).update(`sultan-order-share:${payload}`).digest("base64url");
}

export function createOrderShareToken(orderId: string, nowSeconds = Math.floor(Date.now() / 1000)) {
    const payload = Buffer.from(JSON.stringify({ orderId, exp: nowSeconds + TOKEN_LIFETIME_SECONDS })).toString("base64url");
    return `${payload}.${sign(payload)}`;
}

export function verifyOrderShareToken(token: string | undefined, orderId: string, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (!token || token.length > 2048) return false;
    const [payload, signature, ...extra] = token.split(".");
    if (!payload || !signature || extra.length > 0) return false;

    let expectedSignature: Buffer;
    let providedSignature: Buffer;
    try {
        expectedSignature = Buffer.from(sign(payload), "base64url");
        providedSignature = Buffer.from(signature, "base64url");
    } catch {
        return false;
    }
    if (expectedSignature.length !== providedSignature.length || !timingSafeEqual(expectedSignature, providedSignature)) return false;

    try {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { orderId?: unknown; exp?: unknown };
        return decoded.orderId === orderId && Number.isInteger(decoded.exp) && Number(decoded.exp) > nowSeconds;
    } catch {
        return false;
    }
}
