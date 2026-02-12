---
description: تحديث قاعدة البيانات باستخدام Prisma
---

# تحديث قاعدة البيانات (Prisma)

يستخدم هذا الأمر لتطبيق التغييرات على قاعدة البيانات.

## الخطوات

1. إنشاء migration جديد (بعد تعديل schema.prisma)

```bash
npx prisma migrate dev --name اسم_التغيير
```

1. تطبيق migrations على قاعدة الإنتاج

```bash
npx prisma migrate deploy
```

1. توليد Prisma Client (بعد تعديل schema)

```bash
npx prisma generate
```

1. فتح Prisma Studio لإدارة البيانات

```bash
npx prisma studio
```

## ملاحظات

- استخدم `migrate dev` في التطوير فقط
- استخدم `migrate deploy` في الإنتاج
- `prisma generate` يُنفذ تلقائياً بعد `npm install`
- Prisma Studio يفتح على: <http://localhost:5555>
