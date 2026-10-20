import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

function getSecret() {
    const secret = process.env.ORDER_SHARE_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret || secret.length < 32) throw new Error("A 32-character AUTH_SECRET or ORDER_SHARE_SECRET is required for share links.");
    return secret;
}

function sign(payload: string) {
    return createHmac("sha256", getSecret()).update(`sultan-order-share:${payload}`).digest("base64url");
}

export function createOrderShareToken(orderId: string, version: number, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (!Number.isSafeInteger(version) || version < 0) throw new Error('Invalid share version.');
    const payload = Buffer.from(JSON.stringify({ orderId, version, nonce: randomBytes(16).toString('base64url'), exp: nowSeconds + TOKEN_LIFETIME_SECONDS })).toString("base64url");
    return `${payload}.${sign(payload)}`;
}

export function readOrderShareToken(token: string | undefined, orderId: string, nowSeconds = Math.floor(Date.now() / 1000)): { version: number; exp: number } | null {
    if (!token || token.length > 2048) return null;
    const [payload, signature, ...extra] = token.split(".");
    if (!payload || !signature || extra.length > 0) return null;

    let expectedSignature: Buffer;
    let providedSignature: Buffer;
    try {
        expectedSignature = Buffer.from(sign(payload), "base64url");
        providedSignature = Buffer.from(signature, "base64url");
    } catch {
        return null;
    }
    if (expectedSignature.length !== providedSignature.length || !timingSafeEqual(expectedSignature, providedSignature)) return null;

    try {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { orderId?: unknown; exp?: unknown; version?: unknown };
        // Previously issued links remain valid at version 0 until revoked or expired.
        const version = decoded.version === undefined ? 0 : decoded.version;
        if (decoded.orderId !== orderId || !Number.isSafeInteger(decoded.exp) || Number(decoded.exp) <= nowSeconds || !Number.isSafeInteger(version) || Number(version) < 0) return null;
        return { version: Number(version), exp: Number(decoded.exp) };
    } catch {
        return null;
    }
}

export function verifyOrderShareToken(token: string | undefined, orderId: string, version: number, nowSeconds = Math.floor(Date.now() / 1000)) {
    return readOrderShareToken(token, orderId, nowSeconds)?.version === version;
}
