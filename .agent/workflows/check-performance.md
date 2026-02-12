---
description: فحص أداء البرنامج
---

# فحص الأداء

يستخدم هذا الأمر لفحص وتحسين أداء البرنامج.

## الخطوات

1. فحص أداء الصفحات

```bash
npx lighthouse http://localhost:3000 --view
```

1. فحص Core Web Vitals

```bash
npm run build
npm start
# ثم افتح Chrome DevTools > Lighthouse
```

1. تحليل bundle size

```bash
ANALYZE=true npm run build
```

1. فحص سرعة API

```bash
# استخدم Postman أو
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/orders
```

## ملاحظات

- استهدف Performance Score > 90
- حسّن الصور (استخدم Next.js Image)
- استخدم lazy loading
- قلل حجم JavaScript bundle
- استخدم caching بذكاء
