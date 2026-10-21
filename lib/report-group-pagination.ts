export type ReportGroupKind = 'production' | 'users';
export type ReportGroupCursor = { kind: ReportGroupKind; id: string; value: string };
const amount = /^-?\d{1,30}(?:\.\d{1,2})?$/;
export function encodeReportGroupCursor(cursor: ReportGroupCursor): string {
    if (!amount.test(cursor.value) || cursor.id.length > 200) throw new Error('Invalid report group position.');
    return Buffer.from(JSON.stringify({ v: 1, ...cursor }), 'utf8').toString('base64url');
}
export function decodeReportGroupCursor(value: string | null, kind: ReportGroupKind): ReportGroupCursor | null | false {
    if (!value) return null;
    if (value.length > 512) return false;
    try {
        const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
        if (cursor?.v !== 1 || cursor.kind !== kind || typeof cursor.id !== 'string' || cursor.id.length > 200 || (kind === 'production' && cursor.id.length === 0) || typeof cursor.value !== 'string' || !amount.test(cursor.value)) return false;
        return { kind, id: cursor.id, value: cursor.value };
    } catch { return false; }
}
