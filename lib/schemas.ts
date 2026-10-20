import { z } from "zod";

const MAX_MONEY_AMOUNT = 999_999_999_999.99;

export const moneyAmountSchema = z.preprocess((value) => {
    if (typeof value === "number") {
        if (!Number.isFinite(value) || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) return Number.NaN;
        return value;
    }
    if (typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value.trim())) return Number(value.trim());
    return Number.NaN;
}, z.number().finite().max(MAX_MONEY_AMOUNT, "المبلغ أكبر من الحد المسموح"));

export const orderSchema = z.object({
    customerName: z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل"),
    customerPhone: z.string().regex(/^\d{8,15}$/, "رقم الهاتف غير صحيح"),
    description: z.string().min(5, "الوصف يجب أن يكون 5 أحرف على الأقل"),
    dueDate: z.string().refine((val: string) => !isNaN(Date.parse(val)), {
        message: "تاريخ الاستحقاق غير صحيح",
    }),
    totalAmount: moneyAmountSchema.refine((value) => value > 0, "الإجمالي يجب أن يكون قيمة موجبة"),
    paidAmount: z.preprocess((value) => value === "" || value === null ? "0" : value, moneyAmountSchema),
    factoryId: z.string().min(1, "يجب اختيار المصنع"),
    shopId: z.string().min(1, "يجب اختيار المعرض"),
    status: z.string().optional(),
}).superRefine((order, context) => {
    const totalCents = Math.round((order.totalAmount + Number.EPSILON) * 100);
    const paidCents = Math.round((order.paidAmount + Number.EPSILON) * 100);
    if (paidCents > totalCents) {
        context.addIssue({
            code: "custom",
            path: ["paidAmount"],
            message: "المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الطلب",
        });
    }
});
