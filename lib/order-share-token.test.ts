import { createOrderShareToken, verifyOrderShareToken } from './order-share-token'
import { createHmac } from 'node:crypto'

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
        const token = createOrderShareToken('order-1', 0, now)
        expect(verifyOrderShareToken(token, 'order-1', 0, now + 60)).toBe(true)
        expect(verifyOrderShareToken(token, 'order-2', 0, now + 60)).toBe(false)
        expect(verifyOrderShareToken(token, 'order-1', 0, now + 7 * 24 * 60 * 60)).toBe(false)
    })

    it('rejects altered signatures', () => {
        const token = createOrderShareToken('order-1', 0, 1_800_000_000)
        expect(verifyOrderShareToken(`${token}x`, 'order-1', 0, 1_800_000_001)).toBe(false)
    })

    it('revokes all previous versions while allowing a new grant', () => {
        const now = 1_800_000_000
        const old = createOrderShareToken('order-1', 0, now)
        expect(verifyOrderShareToken(old, 'order-1', 1, now + 1)).toBe(false)
        expect(verifyOrderShareToken(createOrderShareToken('order-1', 1, now), 'order-1', 1, now + 1)).toBe(true)
        expect(createOrderShareToken('order-1', 1, now)).not.toBe(createOrderShareToken('order-1', 1, now))
    })

    it('treats legacy links as version zero and revokes them too', () => {
        const now = 1_800_000_000
        const payload = Buffer.from(JSON.stringify({ orderId: 'order-1', exp: now + 60 })).toString('base64url')
        const signature = createHmac('sha256', process.env.ORDER_SHARE_SECRET!).update(`sultan-order-share:${payload}`).digest('base64url')
        expect(verifyOrderShareToken(`${payload}.${signature}`, 'order-1', 0, now)).toBe(true)
        expect(verifyOrderShareToken(`${payload}.${signature}`, 'order-1', 1, now)).toBe(false)
    })
})
