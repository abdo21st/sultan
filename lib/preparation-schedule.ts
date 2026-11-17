import { BUSINESS_TIME_ZONE } from './business-date';

const STEP_MINUTES = 15;
const MAX_SEARCH_DAYS = 30;

export type PreparationBooking = {
    pickupAt: Date;
    preparationMinutes: number;
};

/** Parse an HTML datetime-local value as a Tripoli wall-clock time. */
export function parseBusinessDateTime(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const [, yearText, monthText, dayText, hourText, minuteText] = match;
    const desired = [Number(yearText), Number(monthText), Number(dayText), Number(hourText), Number(minuteText)];
    const desiredAsUtc = Date.UTC(desired[0], desired[1] - 1, desired[2], desired[3], desired[4]);
    const calendarCheck = new Date(desiredAsUtc);
    if (calendarCheck.getUTCFullYear() !== desired[0] || calendarCheck.getUTCMonth() + 1 !== desired[1] || calendarCheck.getUTCDate() !== desired[2] || desired[3] > 23 || desired[4] > 59) return null;
    const candidate = new Date(desiredAsUtc);

    for (let attempt = 0; attempt < 4; attempt += 1) {
        const parts = new Intl.DateTimeFormat('en', {
            timeZone: BUSINESS_TIME_ZONE,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(candidate);
        const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
        const shownAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
        const delta = desiredAsUtc - shownAsUtc;
        if (delta === 0) return candidate;
        candidate.setTime(candidate.getTime() + delta);
    }
    return null;
}

export function businessDateTimeInput(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function ceilToStep(value: Date): Date {
    const stepMs = STEP_MINUTES * 60_000;
    return new Date(Math.ceil(value.getTime() / stepMs) * stepMs);
}

export function hasPreparationConflict(
    pickupAt: Date,
    preparationMinutes: number,
    bookings: PreparationBooking[],
): boolean {
    const startsAt = pickupAt.getTime() - preparationMinutes * 60_000;
    return bookings.some(booking => {
        const existingStartsAt = booking.pickupAt.getTime() - booking.preparationMinutes * 60_000;
        return startsAt < booking.pickupAt.getTime() && pickupAt.getTime() > existingStartsAt;
    });
}

/**
 * Finds the earliest 15-minute slot whose preparation interval does not overlap
 * an existing booking. Each factory is modeled as one preparation line.
 */
export function findNearestAvailablePickup(
    requestedAt: Date,
    preparationMinutes: number,
    bookings: PreparationBooking[],
    now = new Date(),
    hasDailyCapacity: (pickupAt: Date) => boolean = () => true,
): Date | null {
    const durationMs = preparationMinutes * 60_000;
    const earliestPracticalPickup = new Date(now.getTime() + durationMs);
    let candidate = ceilToStep(new Date(Math.max(requestedAt.getTime(), earliestPracticalPickup.getTime())));
    const horizon = requestedAt.getTime() + MAX_SEARCH_DAYS * 24 * 60 * 60_000;

    while (candidate.getTime() <= horizon) {
        const preparationStartsAt = candidate.getTime() - durationMs;
        const conflicts = bookings.filter(booking => {
            const existingStartsAt = booking.pickupAt.getTime() - booking.preparationMinutes * 60_000;
            const existingEndsAt = booking.pickupAt.getTime();
            return preparationStartsAt < existingEndsAt && candidate.getTime() > existingStartsAt;
        });
        if (conflicts.length === 0 && hasDailyCapacity(candidate)) return candidate;

        if (conflicts.length === 0) {
            candidate = ceilToStep(new Date(candidate.getTime() + STEP_MINUTES * 60_000));
            continue;
        }

        const afterLatestConflict = Math.max(...conflicts.map(booking => booking.pickupAt.getTime() + durationMs));
        candidate = ceilToStep(new Date(Math.max(candidate.getTime() + STEP_MINUTES * 60_000, afterLatestConflict)));
    }
    return null;
}

