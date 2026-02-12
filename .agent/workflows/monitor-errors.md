---
description: مراقبة الأخطاء في الإنتاج
---

# مراقبة الأخطاء

يستخدم هذا الأمر لمراقبة الأخطاء في البرنامج.

## الخطوات

1. إعداد Sentry (اختياري)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

1. عرض logs من Vercel

```bash
vercel logs --follow
```

1. فحص error logs محلياً

```bash
# في development
tail -f .next/server/app-paths-manifest.json
```

1. إنشاء dashboard للأخطاء

```typescript
// app/admin/errors/page.tsx
// عرض الأخطاء من قاعدة البيانات أو Sentry
```

## ملاحظات

- استخدم Sentry للإنتاج
- راقب الأخطاء يومياً
- أصلح الأخطاء المتكررة أولاً
- احتفظ بسجل للأخطاء المحلولة
