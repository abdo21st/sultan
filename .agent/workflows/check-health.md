---
description: فحص صحة النظام
---

# فحص صحة النظام

يستخدم هذا الأمر للتحقق من صحة جميع مكونات النظام.

## الخطوات

1. فحص الاتصال بقاعدة البيانات

```bash
npx prisma db execute --stdin <<< "SELECT 1"
```

1. فحص API endpoints

```bash
curl http://localhost:3000/api/health
```

1. فحص المساحة التخزينية

```bash
df -h
```

1. فحص الذاكرة والـ CPU

```bash
top
htop
```

1. فحص logs للأخطاء

```bash
tail -f .next/server/app-paths-manifest.json
```

## ملاحظات

- نفذ هذا الفحص أسبوعياً
- راقب استخدام الموارد
- تحقق من وجود أخطاء متكررة
- احتفظ بسجل للفحوصات
