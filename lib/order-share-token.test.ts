import { createOrderShareToken, verifyOrderShareToken } from './order-share-token'

describe('order share tokens', () => {
    const previousSecret = process.env.ORDER_SHARE_SECRET

    beforeEach(() => {
        process.env.ORDER_SHARE_SECRET = 'test-secret-that-is-at-least-32-characters-long'
    })

    afterAll(() => {
        if (previousSecret === undefined) delete process.env.ORDER_SHARE_SECRET
        else process.env.ORDER_SHARE_SECRET = previousSecret
    })

    it('accepts an unexpired token only for its order', () => {
        const now = 1_800_000_000
        const token = createOrderShareToken('order-1', now)
        expect(verifyOrderShareToken(token, 'order-1', now + 60)).toBe(true)
        expect(verifyOrderShareToken(token, 'order-2', now + 60)).toBe(false)
        expect(verifyOrderShareToken(token, 'order-1', now + 7 * 24 * 60 * 60)).toBe(false)
    })

    it('rejects altered signatures', () => {
        const token = createOrderShareToken('order-1', 1_800_000_000)
        expect(verifyOrderShareToken(`${token}x`, 'order-1', 1_800_000_001)).toBe(false)
    })
})
