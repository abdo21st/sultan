---
description: رفع التغييرات إلى GitHub
---

# رفع التغييرات إلى GitHub

يستخدم هذا الأمر لرفع التغييرات إلى repository على GitHub.

## الخطوات

// turbo-all

1. إضافة جميع التغييرات

```bash
git add .
```

1. إنشاء commit مع رسالة وصفية

```bash
git commit -m "وصف التغييرات"
```

1. رفع التغييرات إلى GitHub

```bash
git push
```

## ملاحظات

- تأكد من كتابة رسالة commit واضحة بالعربية
- بعد الـ push، Vercel سيقوم بـ deployment تلقائياً
- يمكنك متابعة حالة الـ deployment على: <https://vercel.com>
