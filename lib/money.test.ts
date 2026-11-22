import { moneyAmountSchema, orderSchema } from './schemas'
import { fromCents, toCents, toMoneyNumber } from './money'

describe('money boundaries', () => {
    it('converts decimal values to integer cents', () => {
        expect(toCents('12.35')).toBe(1235)
        expect(fromCents(1235)).toBe(12.35)
        expect(toMoneyNumber({ toNumber: () => 7.25 })).toBe(7.25)
    })

    it('rejects malformed and sub-cent inputs', () => {
        expect(moneyAmountSchema.safeParse('12.345').success).toBe(false)
        expect(moneyAmountSchema.safeParse('12abc').success).toBe(false)
        expect(moneyAmountSchema.safeParse(Number.NaN).success).toBe(false)
    })

    it('rejects an order with payments above its total', () => {
        const result = orderSchema.safeParse({
            customerName: 'Customer',
            customerPhone: '0912345678',
            description: 'Order description',
            dueDate: '2026-11-01',
            totalAmount: '100.00',
            paidAmount: '100.01',
            factoryId: 'factory-id',
            shopId: 'shop-id',
        })
        expect(result.success).toBe(false)
    })

    it('rejects oversized text and malformed dates in orders', () => {
        const validOrder = {
            customerName: 'Customer',
            customerPhone: '0912345678',
            description: 'Order description',
            dueDate: '2026-11-01',
            pickupAt: '2026-11-01T15:00',
            totalAmount: '100.00',
            paidAmount: '0',
            factoryId: 'factory-id',
            shopId: 'shop-id',
        }

        expect(orderSchema.safeParse({ ...validOrder, customerName: 'x'.repeat(121) }).success).toBe(false)
        expect(orderSchema.safeParse({ ...validOrder, description: 'x'.repeat(2001) }).success).toBe(false)
        expect(orderSchema.safeParse({ ...validOrder, dueDate: '2026-02-30' }).success).toBe(false)
        expect(orderSchema.safeParse({ ...validOrder, pickupAt: '2026-11-01T15:00'.repeat(4) }).success).toBe(false)
    })
})
