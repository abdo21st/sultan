const CATEGORY_LABELS: Record<string, string> = {
    SALES: 'مبيعات',
    SALARY: 'رواتب',
    RENT: 'إيجار',
    RAW_MATERIALS: 'مواد خام',
    UTILITIES: 'فواتير وخدمات',
    OTHER: 'أخرى',
    ORDER_REFUND: 'رد مبلغ للعميل',
};

export function transactionCategoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
}
