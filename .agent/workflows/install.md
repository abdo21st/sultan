---
description: تثبيت المكتبات والتبعيات
---

# تثبيت المكتبات

يستخدم هذا الأمر لتثبيت جميع المكتبات المطلوبة للبرنامج.

## الخطوات

// turbo

1. تثبيت جميع المكتبات من package.json

```bash
npm install
```

1. (اختياري) تثبيت مكتبة جديدة

```bash
npm install اسم_المكتبة
```

1. (اختياري) تثبيت مكتبة للتطوير فقط

```bash
npm install -D اسم_المكتبة
```

1. (اختياري) تحديث جميع المكتبات

```bash
npm update
```

## ملاحظات

- نفذ `npm install` بعد clone المشروع
- نفذ `npm install` بعد pull تغييرات جديدة من GitHub
- ملف `package-lock.json` يُحفظ في Git
- لا تحذف مجلد `node_modules` يدوياً
