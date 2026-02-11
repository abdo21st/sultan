import { z } from "zod";

export const orderSchema = z.object({
    customerName: z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل"),
    customerPhone: z.string().regex(/^\d{8,15}$/, "رقم الهاتف غير صحيح"),
    description: z.string().min(5, "الوصف يجب أن يكون 5 أحرف على الأقل"),
    dueDate: z.string().refine((val: string) => !isNaN(Date.parse(val)), {
        message: "تاريخ الاستحقاق غير صحيح",
    }),
    totalAmount: z.preprocess((val) => parseFloat(val as string), z.number().positive("الإجمالي يجب أن يكون قيمة موجبة")),
    paidAmount: z.preprocess((val) => parseFloat((val as string) || "0"), z.number().min(0, "المبلغ المدفوع لا يمكن أن يكون سالباً")),
    factoryId: z.string().min(1, "يجب اختيار المصنع"),
    shopId: z.string().min(1, "يجب اختيار المعرض"),
    status: z.string().optional(),
});
