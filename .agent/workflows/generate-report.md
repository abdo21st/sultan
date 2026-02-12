---
description: إنشاء تقرير مالي شهري
---

# إنشاء تقرير مالي

يستخدم هذا الأمر لإنشاء تقرير مالي شامل.

## الخطوات

1. إنشاء script للتقرير

```typescript
// scripts/generate-report.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateReport(month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate }
    },
    include: { transactions: true }
  });
  
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
  const totalPaid = orders.reduce((sum, o) => sum + o.paid, 0);
  const totalDebts = totalSales - totalPaid;
  
  console.log(`تقرير ${month}/${year}`);
  console.log(`إجمالي المبيعات: ${totalSales} د.ل`);
  console.log(`إجمالي المدفوع: ${totalPaid} د.ل`);
  console.log(`إجمالي الديون: ${totalDebts} د.ل`);
}

const month = parseInt(process.argv[2]);
const year = parseInt(process.argv[3]);
generateReport(month, year);
```

1. تشغيل التقرير

```bash
npx ts-node scripts/generate-report.ts 2 2026
```

## ملاحظات

- يمكن تخصيص التقرير حسب الحاجة
- يمكن إضافة رسوم بيانية
- يمكن إرسال التقرير بالبريد الإلكتروني
- احفظ التقارير للمراجعة المستقبلية
