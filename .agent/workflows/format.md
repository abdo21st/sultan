---
description: تنسيق الكود باستخدام Prettier
---

# تنسيق الكود

يستخدم هذا الأمر لتنسيق الكود بشكل موحد.

## الخطوات

1. تثبيت Prettier (إذا لم يكن مثبتاً)

```bash
npm install -D prettier
```

1. تنسيق جميع الملفات

```bash
npx prettier --write .
```

1. فحص التنسيق بدون تعديل

```bash
npx prettier --check .
```

1. تنسيق ملفات محددة

```bash
npx prettier --write "app/**/*.{ts,tsx}"
```

## ملاحظات

- أضف `.prettierrc` لتخصيص التنسيق
- استخدم مع ESLint للحصول على أفضل نتيجة
- يمكن دمجه مع pre-commit hooks
- VSCode يمكنه التنسيق تلقائياً عند الحفظ
