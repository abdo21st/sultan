---
description: تحسين أداء قاعدة البيانات
---

# تحسين قاعدة البيانات

يستخدم هذا الأمر لتحسين أداء قاعدة البيانات.

## الخطوات

1. تحليل الاستعلامات البطيئة

```sql
-- في PostgreSQL
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

1. إضافة indexes للجداول

```sql
-- مثال: إضافة index على customer phone
CREATE INDEX idx_order_customer_phone ON "Order"("customerPhone");
CREATE INDEX idx_order_status ON "Order"("status");
CREATE INDEX idx_order_created_at ON "Order"("createdAt");
```

1. تنظيف البيانات القديمة

```bash
npx ts-node scripts/cleanup-old-data.ts
```

1. تحديث إحصائيات قاعدة البيانات

```sql
ANALYZE;
VACUUM;
```

## ملاحظات

- نفذ هذا شهرياً أو عند ملاحظة بطء
- راقب حجم قاعدة البيانات
- احذف البيانات المؤقتة القديمة
- استخدم connection pooling
