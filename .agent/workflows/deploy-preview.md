---
description: نشر نسخة تجريبية على Vercel
---

# نشر نسخة تجريبية

يستخدم هذا الأمر لنشر نسخة تجريبية للاختبار قبل الإنتاج.

## الخطوات

1. تثبيت Vercel CLI (مرة واحدة)

```bash
npm install -g vercel
```

1. تسجيل الدخول

```bash
vercel login
```

1. نشر نسخة تجريبية

```bash
vercel
```

1. الحصول على رابط النسخة التجريبية

```bash
vercel ls
```

## ملاحظات

- كل push لفرع غير main ينشئ preview تلقائياً
- استخدم preview للاختبار قبل merge
- شارك رابط preview مع الفريق للمراجعة
- preview deployments لا تؤثر على الإنتاج
