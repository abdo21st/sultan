import { z } from "zod";
import { businessDateKey } from './business-date';
import { parseBusinessDateTime } from './preparation-schedule';

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
    customerName: z.string().trim().min(2, "اسم العميل يجب أن يكون حرفين على الأقل").max(120, "اسم العميل أطول من الحد المسموح"),
    customerPhone: z.string().regex(/^\d{8,15}$/, "رقم الهاتف غير صحيح"),
    description: z.string().trim().min(5, "الوصف يجب أن يكون 5 أحرف على الأقل").max(2000, "وصف الطلب أطول من الحد المسموح"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((val: string) => {
        const parsed = new Date(`${val}T00:00:00.000Z`);
        return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === val;
    }, {
        message: "تاريخ الاستحقاق غير صحيح",
    }),
    pickupAt: z.string().max(16).refine((value) => parseBusinessDateTime(value) !== null, {
        message: "وقت الاستلام غير صحيح",
    }),
    totalAmount: moneyAmountSchema.refine((value) => value > 0, "الإجمالي يجب أن يكون قيمة موجبة"),
    paidAmount: z.preprocess((value) => value === "" || value === null ? "0" : value, moneyAmountSchema),
    factoryId: z.string().min(1, "يجب اختيار المصنع").max(128),
    shopId: z.string().min(1, "يجب اختيار المعرض").max(128),
    status: z.string().optional(),
}).superRefine((order, context) => {
    const totalCents = Math.round((order.totalAmount + Number.EPSILON) * 100);
    const paidCents = Math.round((order.paidAmount + Number.EPSILON) * 100);
    const pickupAt = parseBusinessDateTime(order.pickupAt);
    if (pickupAt && businessDateKey(pickupAt) !== order.dueDate.slice(0, 10)) {
        context.addIssue({
            code: "custom",
            path: ["pickupAt"],
            message: "يجب أن يقع وقت الاستلام في تاريخ التسليم المحدد",
        });
    }
    if (paidCents > totalCents) {
        context.addIssue({
            code: "custom",
            path: ["paidAmount"],
            message: "المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الطلب",
        });
    }
});
