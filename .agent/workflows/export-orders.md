---
description: تصدير الطلبات إلى Excel/CSV
---

# تصدير الطلبات

يستخدم هذا الأمر لتصدير الطلبات إلى ملف Excel أو CSV.

## الخطوات

1. إنشاء script للتصدير (إذا لم يكن موجوداً)

```typescript
// scripts/export-orders.ts
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function exportOrders() {
  const orders = await prisma.order.findMany({
    include: { customer: true, facility: true }
  });
  
  const ws = XLSX.utils.json_to_sheet(orders);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
}

exportOrders();
```

1. تشغيل التصدير

```bash
npx ts-node scripts/export-orders.ts
```

## ملاحظات

- يمكن تصدير فترة زمنية محددة
- يمكن تصدير حسب الحالة أو المصنع
- الملف يُحفظ في مجلد المشروع
- استخدم هذا للتقارير والأرشفة
