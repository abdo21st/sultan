'use client';

export type GroupingMode = 'none' | 'day' | 'week' | 'month';
export default function DateTabs({ activeMode, onModeChange }: { activeMode: GroupingMode; onModeChange: (mode: GroupingMode) => void }) {
    return <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-muted-foreground">تجميع الطلبات حسب الاستحقاق:</span><div className="ui-tabs" role="group" aria-label="تجميع الطلبات حسب الاستحقاق">{([
        ['none', 'دون تجميع'], ['day', 'اليوم'], ['week', 'الأسبوع'], ['month', 'الشهر'],
    ] as const).map(([mode, label]) => <button type="button" className="ui-tab" key={mode} aria-pressed={activeMode === mode} onClick={() => onModeChange(mode)}>{label}</button>)}</div></div>;
}
