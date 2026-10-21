'use client';

export type GroupingMode = 'none' | 'day' | 'week' | 'month';
export default function DateTabs({ activeMode, onModeChange }: { activeMode: GroupingMode; onModeChange: (mode: GroupingMode) => void }) {
    return <div className="order-grouping"><span>ترتيب العرض</span><div className="ui-tabs" role="group" aria-label="تجميع الطلبات حسب الاستحقاق">{([
        ['none', 'دون تجميع'], ['day', 'حسب اليوم'], ['week', 'حسب الأسبوع'], ['month', 'حسب الشهر'],
    ] as const).map(([mode, label]) => <button type="button" className="ui-tab" key={mode} aria-pressed={activeMode === mode} onClick={() => onModeChange(mode)}>{label}</button>)}</div></div>;
}
