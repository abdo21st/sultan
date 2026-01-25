// Test script using API endpoints instead of direct database access
// This works even if database credentials are not available in the script environment

const BASE_URL = 'http://localhost:3000';

async function testNewFeatures() {
    console.log('🧪 بدء اختبار الميزات الجديدة عبر API...\n');

    try {
        // Test 1: Get all facilities
        console.log('📋 اختبار 1: جلب جميع المنشآت');
        const facilitiesRes = await fetch(`${BASE_URL}/api/facilities`);
        const facilities = await facilitiesRes.json();
        console.log(`✅ عدد المنشآت: ${Array.isArray(facilities) ? facilities.length : 'خطأ'}`);
        if (Array.isArray(facilities)) {
            facilities.forEach(f => {
                console.log(`   - ${f.name} (${f.type}) - ${f.location || 'N/A'}`);
            });
        }

        // Test 2: Create a test facility
        console.log('\n📝 اختبار 2: إنشاء منشأة تجريبية');
        const createRes = await fetch(`${BASE_URL}/api/facilities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'منشأة اختبار API',
                type: 'FACTORY',
                location: 'القاهرة'
            })
        });

        if (createRes.ok) {
            const newFacility = await createRes.json();
            console.log('✅ تم إنشاء المنشأة:', newFacility.name || 'تم بنجاح');

            // Test 3: Try to delete the test facility
            if (newFacility.id) {
                console.log('\n🗑️ اختبار 3: حذف المنشأة التجريبية');
                const deleteRes = await fetch(`${BASE_URL}/api/facilities/${newFacility.id}`, {
                    method: 'DELETE'
                });

                if (deleteRes.ok) {
                    console.log('✅ تم حذف المنشأة بنجاح');
                } else {
                    const error = await deleteRes.json();
                    console.log(`⚠️ لم يتم الحذف: ${error.error}`);
                }
            }
        } else {
            const error = await createRes.json();
            console.log(`❌ فشل إنشاء المنشأة: ${error.error || createRes.statusText}`);
        }

        // Test 4: Get all users
        console.log('\n👥 اختبار 4: جلب جميع المستخدمين');
        const usersRes = await fetch(`${BASE_URL}/api/users`);
        const users = await usersRes.json();
        console.log(`✅ عدد المستخدمين: ${Array.isArray(users) ? users.length : 'خطأ'}`);

        // Test 5: Check settings page endpoints
        console.log('\n⚙️ اختبار 5: التحقق من نقاط نهاية الإعدادات');

        // Note: These endpoints require authentication, so they might return 401/403
        const settingsRes = await fetch(`${BASE_URL}/api/settings`);
        console.log(`   - GET /api/settings: ${settingsRes.status} ${settingsRes.statusText}`);

        console.log('\n✅ اكتملت جميع اختبارات API!');
        console.log('\n📝 ملاحظة: بعض الاختبارات قد تفشل بسبب المصادقة - هذا طبيعي');
        console.log('   للاختبار الكامل، استخدم المتصفح وقم بتسجيل الدخول');

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('\n❌ خطأ في الاختبار:', message);
        console.log('\n💡 تأكد من أن الخادم يعمل على http://localhost:3000');
        console.log('   قم بتشغيل: npm run dev');
    }
}

// Run tests
testNewFeatures()
    .then(() => {
        console.log('\n🎉 انتهى الاختبار');
        process.exit(0);
    })
    .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('\n💥 فشل الاختبار:', message);
        process.exit(1);
    });
