'use client';

export type GroupingMode = 'none' | 'day' | 'week' | 'month';
export default function DateTabs({ activeMode, onModeChange }: { activeMode: GroupingMode; onModeChange: (mode: GroupingMode) => void }) {
    return <label className="order-grouping"><span className="sr-only">تجميع الطلبات حسب الاستحقاق</span><select className="ui-field" value={activeMode} onChange={event => onModeChange(event.target.value as GroupingMode)}>{([
        ['none', 'دون تجميع'], ['day', 'حسب اليوم'], ['week', 'حسب الأسبوع'], ['month', 'حسب الشهر'],
    ] as const).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}</select></label>;
}
