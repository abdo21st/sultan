// Run inside the release migrator, with only the disposable QA database environment.
import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const url = new URL(process.env.DATABASE_URL || 'invalid:');
if (url.hostname !== 'sultan-db' || url.pathname !== '/sultan_mobile_acceptance' || !process.env.QA_ACCOUNT_USERNAME || !process.env.QA_ACCOUNT_PASSWORD) throw new Error('The fixture requires the disposable mobile acceptance database.');
const client = new Client({ connectionString: url.href });
await client.connect();
try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO "Facility" (id,name,type,location) VALUES
        ('mobile_acceptance_factory','مصنع اختباري','FACTORY','بيانات مصطنعة'),
        ('mobile_acceptance_shop','معرض اختباري','SHOP','بيانات مصطنعة') ON CONFLICT (id) DO NOTHING`);
    await client.query(`INSERT INTO "User" (id,username,password,"displayName",role,"facilityId","mustChangePassword","sessionVersion",permissions,"updatedAt")
        VALUES ('mobile_acceptance_actor',$1,$2,'حساب اختبار الهاتف','MANAGER','mobile_acceptance_shop',false,0,ARRAY[]::text[],NOW()) ON CONFLICT (id) DO NOTHING`, [process.env.QA_ACCOUNT_USERNAME, await bcrypt.hash(process.env.QA_ACCOUNT_PASSWORD, 12)]);
    await client.query(`INSERT INTO "SystemSettings" (id,"appName","whatsappAutoSend","updatedAt") VALUES ('default','سلطان — بيئة اختبار الهاتف',false,NOW())
        ON CONFLICT (id) DO UPDATE SET "appName"=EXCLUDED."appName","whatsappAutoSend"=false`);
    await client.query(`INSERT INTO "Order" (id,"customerName","customerPhone",description,"dueDate","totalAmount","paidAmount","remainingAmount",images,"factoryId","shopId","updatedAt")
        VALUES ('mobile_acceptance_order','طلب تهيئة اختباري','0910000000','بيانات مصطنعة لقراءة صورة خاصة. أنشئ طلباً مستقلاً عند اختبار المزامنة من الهاتف.',NOW()+INTERVAL '8 days',100,0,100,ARRAY['sultan-local://orders/f0000000-0000-4000-8000-000000000001.png'],'mobile_acceptance_factory','mobile_acceptance_shop',NOW()) ON CONFLICT (id) DO NOTHING`);
    await client.query(`INSERT INTO "AuditLog" (id,"actorId","entityType","entityId",action,"after") VALUES ('mobile_acceptance_fixture_created','mobile_acceptance_actor','ORDER','mobile_acceptance_order','ACCEPTANCE_FIXTURE_CREATED','{"synthetic":true,"purpose":"mobile offline acceptance"}'::jsonb) ON CONFLICT (id) DO NOTHING`);
    await client.query('COMMIT');
    console.log(JSON.stringify({ mobileAcceptanceFixture: true, realDataUsed: false, passwordChangedOnRerun: false }));
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
