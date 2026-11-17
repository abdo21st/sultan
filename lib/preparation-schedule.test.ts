import { businessDateTimeInput, findNearestAvailablePickup, parseBusinessDateTime } from './preparation-schedule';

describe('factory preparation scheduling', () => {
    test('parses and formats Tripoli wall-clock times independently of the host timezone', () => {
        const parsed = parseBusinessDateTime('2027-02-08T16:30');
        expect(parsed?.toISOString()).toBe('2027-02-08T14:30:00.000Z');
        expect(businessDateTimeInput(parsed!)).toBe('2027-02-08T16:30');
    });

    test('rejects impossible or malformed local times', () => {
        expect(parseBusinessDateTime('2027-02-30T16:00')).toBeNull();
        expect(parseBusinessDateTime('2027-02-08')).toBeNull();
        expect(parseBusinessDateTime('2027-02-08T24:00')).toBeNull();
    });

    test('keeps a requested time when the preparation interval is free', () => {
        const requested = parseBusinessDateTime('2027-02-08T16:00')!;
        const result = findNearestAvailablePickup(requested, 60, [], new Date('2027-02-01T00:00:00Z'));
        expect(businessDateTimeInput(result!)).toBe('2027-02-08T16:00');
    });

    test('moves the booking after an overlapping factory preparation interval', () => {
        const requested = parseBusinessDateTime('2027-02-08T11:00')!;
        const previousPickup = parseBusinessDateTime('2027-02-08T10:30')!;
        const result = findNearestAvailablePickup(requested, 60, [
            { pickupAt: previousPickup, preparationMinutes: 60 },
        ], new Date('2027-02-01T00:00:00Z'));
        expect(businessDateTimeInput(result!)).toBe('2027-02-08T11:30');
    });

    test('does not overlap adjacent preparation intervals', () => {
        const requested = parseBusinessDateTime('2027-02-08T11:00')!;
        const previousPickup = parseBusinessDateTime('2027-02-08T10:00')!;
        const result = findNearestAvailablePickup(requested, 60, [
            { pickupAt: previousPickup, preparationMinutes: 60 },
        ], new Date('2027-02-01T00:00:00Z'));
        expect(businessDateTimeInput(result!)).toBe('2027-02-08T11:00');
    });

    test('allows same-day booking only after its preparation can start', () => {
        const requested = parseBusinessDateTime('2027-02-08T12:00')!;
        const now = parseBusinessDateTime('2027-02-08T11:45')!;
        const result = findNearestAvailablePickup(requested, 60, [], now);
        expect(businessDateTimeInput(result!)).toBe('2027-02-08T12:45');
    });

    test('returns no suggestion when the full search horizon has no capacity', () => {
        const requested = parseBusinessDateTime('2027-02-08T10:00')!;
        const result = findNearestAvailablePickup(requested, 60, [], new Date('2027-02-01T00:00:00Z'), () => false);
        expect(result).toBeNull();
    });
});
