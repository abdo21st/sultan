import { getCapacitySummary } from './capacity';

describe('daily production capacity warnings', () => {
    const dateRule = {
        factoryId: 'factory-1', dayOfWeek: null, specificDate: new Date('2027-02-08T00:00:00Z'), maxCapacity: 10, warningPercent: 80,
    };

    test('warns at the configured threshold while allowing another order', () => {
        const summary = getCapacitySummary([dateRule], 'factory-1', '2027-02-08', 8);
        expect(summary).toMatchObject({ limit: 10, warningAt: 8, approaching: true, full: false });
    });

    test('blocks only after the maximum count is already reached', () => {
        expect(getCapacitySummary([dateRule], 'factory-1', '2027-02-08', 10).full).toBe(true);
    });

    test('uses the most restrictive matching factory and global rules', () => {
        const globalRule = { ...dateRule, factoryId: null, maxCapacity: 12, warningPercent: 75 };
        expect(getCapacitySummary([dateRule, globalRule], 'factory-1', '2027-02-08', 8)).toMatchObject({
            limit: 10, warningPercent: 80, warningAt: 8, approaching: true,
        });
    });

    test('does not apply another factory rule', () => {
        expect(getCapacitySummary([{ ...dateRule, factoryId: 'factory-2' }], 'factory-1', '2027-02-08', 22).limit).toBeNull();
    });
});
