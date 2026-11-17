import { businessDateKey } from './business-date';

export type CapacityRuleLike = {
    factoryId: string | null;
    dayOfWeek: number | null;
    specificDate: Date | null;
    maxCapacity: number;
    warningPercent: number;
};

export function businessDateStart(day: string): Date {
    return new Date(`${day}T00:00:00.000Z`);
}

export function rulesForBusinessDay<T extends CapacityRuleLike>(rules: T[], factoryId: string, day: string): T[] {
    const dayOfWeek = businessDateStart(day).getUTCDay();
    return rules.filter(rule => {
        const appliesToFactory = rule.factoryId === null || rule.factoryId === factoryId;
        if (!appliesToFactory) return false;
        if (rule.specificDate) return businessDateKey(rule.specificDate) === day;
        return rule.dayOfWeek === dayOfWeek;
    });
}

export function getCapacitySummary(rules: CapacityRuleLike[], factoryId: string, day: string, orderCount: number) {
    const active = rulesForBusinessDay(rules, factoryId, day);
    if (active.length === 0) {
        return { orderCount, limit: null as number | null, warningPercent: null as number | null, warningAt: null as number | null, full: false, approaching: false };
    }
    const limit = Math.min(...active.map(rule => rule.maxCapacity));
    const restrictiveRules = active.filter(rule => rule.maxCapacity === limit);
    const warningPercent = Math.min(...restrictiveRules.map(rule => rule.warningPercent ?? 80));
    const warningAt = Math.max(1, Math.ceil(limit * warningPercent / 100));
    return {
        orderCount,
        limit,
        warningPercent,
        warningAt,
        full: orderCount >= limit,
        approaching: orderCount >= warningAt && orderCount < limit,
    };
}

