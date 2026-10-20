import { decodeDateIdCursor, encodeDateIdCursor, parsePageSize } from './keyset-pagination'

describe('keyset pagination', () => {
    it('round trips a timestamp and identifier', () => {
        const date = new Date('2026-10-20T12:30:00.000Z')
        const cursor = encodeDateIdCursor(date, 'order_123')
        expect(decodeDateIdCursor(cursor)).toEqual({ date, id: 'order_123' })
    })

    it('rejects malformed cursors and page sizes', () => {
        expect(decodeDateIdCursor('not-a-cursor')).toBe(false)
        expect(parsePageSize('0')).toBeNull()
        expect(parsePageSize('101')).toBeNull()
        expect(parsePageSize(null)).toBe(50)
    })
})
