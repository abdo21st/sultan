---
description: فحص الأخطاء وتنسيق الكود
---

# فحص وتنسيق الكود

يستخدم هذا الأمر لفحص الأخطاء وتنسيق الكود.

## الخطوات

// turbo-all

1. فحص الأخطاء باستخدام ESLint

```bash
npm run lint
```

1. إصلاح الأخطاء تلقائياً (إن أمكن)

```bash
npm run lint -- --fix
```

1. (اختياري) فحص TypeScript

```bash
npx tsc --noEmit
```

## ملاحظات

- نفذ `npm run lint` قبل الـ commit
- بعض الأخطاء تُصلح تلقائياً مع `--fix`
- Vercel يفحص الأخطاء تلقائياً قبل الـ deployment
- تجاهل warnings البسيطة (مثل inline styles)
