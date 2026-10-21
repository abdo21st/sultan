import { decodeReportGroupCursor, encodeReportGroupCursor } from './report-group-pagination';
it('keeps exact signed amounts and the system group in a stable cursor', () => {
    const cursor = { kind: 'users' as const, id: '', value: '-1200.01' };
    expect(decodeReportGroupCursor(encodeReportGroupCursor(cursor), 'users')).toEqual(cursor);
});
it('rejects a different report kind and malformed positions', () => {
    expect(decodeReportGroupCursor(encodeReportGroupCursor({ kind: 'users', id: 'u', value: '1.00' }), 'production')).toBe(false);
    for (const value of ['invalid', 'x'.repeat(513), Buffer.from(JSON.stringify({ v: 1, kind: 'users', id: 'u', value: '1e2' })).toString('base64url')]) expect(decodeReportGroupCursor(value, 'users')).toBe(false);
    expect(decodeReportGroupCursor(null, 'production')).toBeNull();
});
