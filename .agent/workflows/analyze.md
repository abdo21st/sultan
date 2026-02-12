---
description: تحليل حجم Bundle وأداء البرنامج
---

# تحليل حجم Bundle

يستخدم هذا الأمر لتحليل حجم ملفات البرنامج وتحديد المكتبات الكبيرة.

## الخطوات

1. تثبيت أداة التحليل

```bash
npm install -D @next/bundle-analyzer
```

1. تحليل Bundle

```bash
ANALYZE=true npm run build
```

1. فحص أداء البرنامج

```bash
npm run build
npx lighthouse http://localhost:3000 --view
```

1. فحص TypeScript

```bash
npx tsc --noEmit
```

## ملاحظات

- سيفتح تقرير تفاعلي في المتصفح
- ابحث عن المكتبات الكبيرة غير الضرورية
- استخدم dynamic imports للمكتبات الكبيرة
- استهدف bundle size أقل من 200KB
