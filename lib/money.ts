export type MoneyValue = number | string | { toNumber(): number } | null | undefined;

export function toMoneyNumber(value: MoneyValue): number {
    const numberValue = typeof value === "object" && value !== null && "toNumber" in value
        ? value.toNumber()
        : Number(value ?? 0);
    if (!Number.isFinite(numberValue)) throw new Error("Invalid monetary value");
    return numberValue;
}

export function toCents(value: MoneyValue): number {
    return Math.round((toMoneyNumber(value) + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
    if (!Number.isSafeInteger(cents)) throw new Error("Monetary value exceeds the supported range");
    return cents / 100;
}
