export const BUSINESS_TIME_ZONE = 'Africa/Tripoli';

/** Calendar dates in the business timezone, independent of server/browser timezone. */
export function businessDateKey(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const part = (type: string) => parts.find(item => item.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

export function shiftDateKey(day: string, days: number): string {
    const date = new Date(`${day}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export function businessDayBounds(day: string) {
    // Due dates are stored as calendar dates by the order form. Query the full
    // Tripoli day as well, to include records with an explicit time of day.
    return {
        gte: new Date(`${day}T00:00:00+02:00`),
        lt: new Date(`${shiftDateKey(day, 1)}T00:00:00+02:00`),
    };
}
