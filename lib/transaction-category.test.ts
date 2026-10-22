import { transactionCategoryLabel } from './transaction-category';

it.each([
    ['SALES', 'مبيعات'],
    ['SALARY', 'رواتب'],
    ['RENT', 'إيجار'],
    ['RAW_MATERIALS', 'مواد خام'],
    ['UTILITIES', 'فواتير وخدمات'],
    ['OTHER', 'أخرى'],
    ['ORDER_REFUND', 'رد مبلغ للعميل'],
    ['تصنيف مخصص', 'تصنيف مخصص'],
])('shows the category %s in Arabic without changing its stored code', (category, label) => {
    expect(transactionCategoryLabel(category)).toBe(label);
});
