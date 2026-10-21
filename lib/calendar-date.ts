/** Business dates are independent of the device timezone. */
export function libyaDateKey(value: Date | string = new Date()): string {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
    const part = (type: string) => parts.find(item => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

export function orderDueLabel(value: string): { label: string; overdue: boolean } {
    const day = libyaDateKey(value);
    const today = libyaDateKey();
    if (day === today) return { label: 'موعده اليوم', overdue: false };
    return { label: new Date(value).toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', day: 'numeric', month: 'short', year: 'numeric' }), overdue: day < today };
}
