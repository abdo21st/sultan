# 📚 دليل الأوامر - برنامج سلطان

هذا الدليل يحتوي على جميع الأوامر المستخدمة في برنامج سلطان لإدارة الطلبات.

## 🚀 الأوامر السريعة (Workflows)

يمكنك استخدام الأوامر التالية مباشرة في Antigravity:

| الأمر | الوصف |
| --- | --- |
| `/run-dev` | تشغيل البرنامج محلياً |
| `/git-push` | رفع التغييرات إلى GitHub |
| `/build` | بناء البرنامج للإنتاج |
| `/database` | إدارة قاعدة البيانات (Prisma) |
| `/install` | تثبيت المكتبات |
| `/lint` | فحص وتنسيق الكود |
| `/backup` | نسخ احتياطي للبيانات |
| `/restore` | استعادة البيانات |
| `/test` | تشغيل الاختبارات |
| `/clean` | تنظيف المشروع |
| `/analyze` | تحليل الأداء |
| `/format` | تنسيق الكود |
| `/deploy-preview` | نشر نسخة تجريبية |
| `/seed-db` | ملء قاعدة البيانات |
| `/security-check` | فحص الأمان |
| `/update-deps` | تحديث المكتبات |
| `/export-orders` | تصدير الطلبات إلى Excel/CSV |
| `/generate-report` | إنشاء تقرير مالي شهري |
| `/optimize-db` | تحسين أداء قاعدة البيانات |
| `/check-health` | فحص صحة النظام |
| `/create-component` | إنشاء component جديد بسرعة |
| `/create-api` | إنشاء API route جديد |
| `/monitor-errors` | مراقبة الأخطاء في الإنتاج |
| `/check-performance` | فحص أداء البرنامج |

---

## 📦 أوامر NPM

### التطوير

```bash
npm run dev          # تشغيل خادم التطوير
npm run build        # بناء البرنامج للإنتاج
npm start            # تشغيل نسخة الإنتاج
npm run lint         # فحص الأخطاء
npm run lint -- --fix # إصلاح الأخطاء تلقائياً
```

### إدارة المكتبات

```bash
npm install                    # تثبيت جميع المكتبات
npm install <package>          # تثبيت مكتبة جديدة
npm install -D <package>       # تثبيت مكتبة للتطوير
npm update                     # تحديث المكتبات
npm uninstall <package>        # حذف مكتبة
```

---

## 🗄️ أوامر Prisma (قاعدة البيانات)

### Migrations

```bash
npx prisma migrate dev --name <name>    # إنشاء migration جديد
npx prisma migrate deploy               # تطبيق migrations (إنتاج)
npx prisma migrate reset                # إعادة تعيين قاعدة البيانات
```

### إدارة البيانات

```bash
npx prisma generate      # توليد Prisma Client
npx prisma studio        # فتح واجهة إدارة البيانات
npx prisma db push       # تطبيق schema مباشرة (تطوير)
npx prisma db seed       # ملء قاعدة البيانات ببيانات تجريبية
```

### فحص Schema

```bash
npx prisma validate      # التحقق من صحة schema
npx prisma format        # تنسيق schema.prisma
```

---

## 🔧 أوامر Git

### الأساسيات

```bash
git status               # عرض حالة الملفات
git add .                # إضافة جميع التغييرات
git add <file>           # إضافة ملف محدد
git commit -m "message"  # إنشاء commit
git push                 # رفع التغييرات
git pull                 # سحب التحديثات
```

### Branches

```bash
git branch                    # عرض الفروع
git branch <name>             # إنشاء فرع جديد
git checkout <branch>         # الانتقال لفرع
git checkout -b <branch>      # إنشاء فرع والانتقال إليه
git merge <branch>            # دمج فرع
git branch -d <branch>        # حذف فرع
```

### التراجع والإصلاح

```bash
git log                       # عرض سجل commits
git diff                      # عرض التغييرات
git reset --hard HEAD         # التراجع عن جميع التغييرات
git reset --soft HEAD~1       # التراجع عن آخر commit
git stash                     # حفظ التغييرات مؤقتاً
git stash pop                 # استرجاع التغييرات المحفوظة
```

---

## 🌐 أوامر Vercel (Deployment)

### CLI Commands

```bash
vercel                   # deploy للـ preview
vercel --prod            # deploy للإنتاج
vercel env ls            # عرض متغيرات البيئة
vercel env add           # إضافة متغير بيئة
vercel logs              # عرض logs
vercel domains           # إدارة النطاقات
```

---

## 🧪 أوامر الاختبار

### TypeScript

```bash
npx tsc --noEmit         # فحص أخطاء TypeScript
npx tsc --watch          # مراقبة الأخطاء
```

### Testing (إذا تم إضافة Jest)

```bash
npm test                 # تشغيل الاختبارات
npm test -- --watch      # مراقعة الاختبارات
npm test -- --coverage   # تقرير التغطية
```

---

## 📝 ملاحظات مهمة

### التطوير المحلي

- الخادم يعمل على: `http://localhost:3000`
- Prisma Studio يعمل على: `http://localhost:5555`
- Hot Reload مفعل تلقائياً

### قاعدة البيانات

- استخدم `migrate dev` في التطوير
- استخدم `migrate deploy` في الإنتاج
- نفذ `prisma generate` بعد تعديل schema

### Git & Deployment

- كل push إلى `main` يُنشئ deployment تلقائياً على Vercel
- راجع التغييرات قبل الـ push
- استخدم رسائل commit واضحة بالعربية

### الأمان

- لا ترفع ملف `.env` إلى Git
- احفظ المتغيرات الحساسة في Vercel Environment Variables
- راجع الصلاحيات قبل إضافة مستخدمين جدد

---

## 🔗 روابط مفيدة

- **الموقع المباشر**: <https://sultan23.vercel.app>
- **Vercel Dashboard**: <https://vercel.com/abdo-hamz-hamzas-projects/sultan>
- **GitHub Repository**: <https://github.com/abdo21st/sultan>

---

## 📞 الدعم

للمساعدة أو الاستفسارات، استخدم Antigravity مع الأوامر السريعة المذكورة أعلاه.

---

## 🔍 أوامر التشخيص واستكشاف الأخطاء

### فحص قاعدة البيانات والتوثيق

```bash
# فحص المستخدمين مباشرة (Bypass Prisma)
npx tsx scripts/check-users-direct.ts

# اختبار مطابقة كلمة المرور برمجياً
npx tsx scripts/test-bcrypt.ts

# اختبار نقطة النهاية التشخيصية برمجياً
node -e "const http = require('http'); const data = JSON.stringify({username: 'master', password: 'any'}); const options = { hostname: 'localhost', port: 3000, path: '/api/auth-debug', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }; const req = http.request(options, (res) => { let body = ''; res.on('data', (d) => body += d); res.on('end', () => { console.log('STATUS:', res.statusCode); console.log('BODY:', body); }); }); req.on('error', (e) => console.error(e)); req.write(data); req.end();"

# فحص المخطط الحالي من قاعدة البيانات مباشرة
npx prisma db pull --print
```

### تنظيف الملفات المؤقتة (PowerShell)

```powershell
Remove-Item -Path "app/api/auth-debug/route.ts", "scripts/check-users-direct.ts", "scripts/test-bcrypt.ts" -ErrorAction SilentlyContinue
```
