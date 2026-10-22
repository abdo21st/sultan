import { libyaDateKey, orderDueLabel } from './calendar-date';

describe('Libya business dates used by the order interface', () => {
    afterEach(() => jest.useRealTimers());

    it.each([
        ['2026-10-21T21:59:59Z', '2026-10-21'],
        ['2026-10-21T22:00:00Z', '2026-10-22'],
        ['2026-10-22T23:30:00+05:00', '2026-10-22'],
        ['2026-10-22', '2026-10-22'],
    ])('uses the Libya calendar day for %s', (value, expected) => {
        expect(libyaDateKey(value)).toBe(expected);
    });

    it('marks today using Libya midnight rather than the device day', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-10-21T22:30:00Z'));
        expect(orderDueLabel('2026-10-22')).toEqual({ label: 'موعده اليوم', overdue: false });
        expect(orderDueLabel('2026-10-21').overdue).toBe(true);
        expect(orderDueLabel('2026-10-23').overdue).toBe(false);
    });
});
