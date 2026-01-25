import { prisma } from '../lib/prisma';

// No need to create new instance, use the existing one

async function testNewFeatures() {
    console.log('🧪 بدء اختبار الميزات الجديدة...\n');

    try {
        // Test 1: Create a test facility
        console.log('📝 اختبار 1: إنشاء منشأة تجريبية');
        const testFacility = await prisma.facility.create({
            data: {
                name: 'منشأة اختبار',
                type: 'FACTORY',
                location: 'القاهرة'
            }
        });
        console.log('✅ تم إنشاء المنشأة:', testFacility.name);

        // Test 2: List all facilities
        console.log('\n📋 اختبار 2: عرض جميع المنشآت');
        const facilities = await prisma.facility.findMany();
        console.log(`✅ عدد المنشآت: ${facilities.length}`);
        facilities.forEach(f => {
            console.log(`   - ${f.name} (${f.type}) - ${f.location}`);
        });

        // Test 3: Try to delete facility with no dependencies
        console.log('\n🗑️ اختبار 3: حذف منشأة فارغة');
        const ordersCount = await prisma.order.count({
            where: {
                OR: [
                    { factoryId: testFacility.id },
                    { shopId: testFacility.id }
                ]
            }
        });
        const usersCount = await prisma.user.count({
            where: { facilityId: testFacility.id }
        });

        if (ordersCount === 0 && usersCount === 0) {
            await prisma.facility.delete({
                where: { id: testFacility.id }
            });
            console.log('✅ تم حذف المنشأة بنجاح (لا توجد ارتباطات)');
        } else {
            console.log(`⚠️ لا يمكن الحذف: ${ordersCount} طلب، ${usersCount} مستخدم`);
        }

        // Test 4: Count users before deletion
        console.log('\n👥 اختبار 4: عدد المستخدمين الحالي');
        const totalUsers = await prisma.user.count();
        console.log(`✅ عدد المستخدمين: ${totalUsers}`);

        // Test 5: Create test users
        console.log('\n➕ اختبار 5: إنشاء مستخدمين تجريبيين');
        const testUser1 = await prisma.user.create({
            data: {
                username: 'test_user_1',
                displayName: 'مستخدم تجريبي 1',
                password: 'test123',
                role: 'USER'
            }
        });
        const testUser2 = await prisma.user.create({
            data: {
                username: 'test_user_2',
                displayName: 'مستخدم تجريبي 2',
                password: 'test123',
                role: 'USER'
            }
        });
        console.log('✅ تم إنشاء مستخدمين تجريبيين');

        // Test 6: Delete individual user
        console.log('\n🗑️ اختبار 6: حذف مستخدم واحد');
        await prisma.user.delete({
            where: { id: testUser1.id }
        });
        console.log('✅ تم حذف المستخدم الأول');

        // Test 7: Verify deletion
        console.log('\n✔️ اختبار 7: التحقق من الحذف');
        const remainingUsers = await prisma.user.count();
        console.log(`✅ عدد المستخدمين المتبقي: ${remainingUsers}`);

        // Test 8: Clean up - delete test user 2
        console.log('\n🧹 تنظيف: حذف المستخدم التجريبي الثاني');
        await prisma.user.delete({
            where: { id: testUser2.id }
        });
        console.log('✅ تم التنظيف');

        // Test 9: Check permissions exist
        console.log('\n🔐 اختبار 9: التحقق من الصلاحيات');
        const adminRole = await prisma.customRole.findFirst({
            where: { name: 'ADMIN' }
        });
        if (adminRole) {
            const hasDeletePermission = adminRole.permissions.includes('users:delete');
            console.log(`✅ صلاحية حذف المستخدمين: ${hasDeletePermission ? 'موجودة' : 'غير موجودة'}`);
        }

        console.log('\n✅ اكتملت جميع الاختبارات بنجاح!');

    } catch (error) {
        console.error('\n❌ خطأ في الاختبار:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
testNewFeatures()
    .then(() => {
        console.log('\n🎉 انتهى الاختبار');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 فشل الاختبار:', error);
        process.exit(1);
    });
