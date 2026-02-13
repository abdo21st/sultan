import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStatusInfo, formatCurrency, formatDate } from "@/lib/utils";

export default async function ShareOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const order = await prisma.order.findUnique({
        where: { id },
    });

    if (!order) notFound();

    const statusInfo = getStatusInfo(order.status);

    // Fetch facility names
    const factory = order.factoryId ? await prisma.facility.findUnique({ where: { id: order.factoryId } }) : null;
    const shop = order.shopId ? await prisma.facility.findUnique({ where: { id: order.shopId } }) : null;

    // Get system settings for branding
    const settings = await prisma.systemSettings.findFirst();

    return (
        <div className="min-h-screen bg-white">
            <div className="p-8 max-w-4xl mx-auto">
                {/* Header with branding */}
                <div className="text-center mb-8 pb-6 border-b-2 border-amber-600">
                    <h1 className="text-3xl font-black text-amber-700 mb-2">{settings?.appName || 'سلطان'}</h1>
                    <p className="text-sm text-gray-600">مستند طلب رقم #{order.serialNumber}</p>
                </div>

                {/* Status Badge */}
                <div className="mb-6 text-center">
                    <span className={`inline-block px-6 py-2 rounded-lg text-sm font-black uppercase ${statusInfo.color} border-2 border-current`}>
                        {statusInfo.label}
                    </span>
                </div>

                {/* Customer Info */}
                <div className="bg-amber-50 p-6 rounded-xl mb-6 border-2 border-amber-200">
                    <h2 className="text-lg font-black text-amber-800 mb-4">بيانات العميل</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-600 mb-1">اسم العميل</p>
                            <p className="text-lg font-bold">{order.customerName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 mb-1">رقم التواصل</p>
                            <p className="text-lg font-bold font-mono" dir="ltr">{order.customerPhone}</p>
                        </div>
                    </div>
                </div>

                {/* Order Details */}
                <div className="bg-gray-50 p-6 rounded-xl mb-6 border-2 border-gray-200">
                    <h2 className="text-lg font-black text-gray-800 mb-4">تفاصيل الطلب</h2>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                        <p className="text-sm whitespace-pre-wrap">{order.description}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-600 mb-1">المعرض</p>
                            <p className="text-sm font-bold">{shop?.name || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 mb-1">المصنع</p>
                            <p className="text-sm font-bold">{factory?.name || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 mb-1">تاريخ الاستحقاق</p>
                            <p className="text-sm font-bold">{formatDate(order.dueDate)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 mb-1">تاريخ الإنشاء</p>
                            <p className="text-sm font-bold">{formatDate(order.createdAt)}</p>
                        </div>
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-green-50 p-6 rounded-xl border-2 border-green-200">
                    <h2 className="text-lg font-black text-green-800 mb-4">الملخص المالي</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">القيمة الإجمالية</span>
                            <span className="text-xl font-black font-mono" dir="ltr">{formatCurrency(order.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center text-green-600">
                            <span className="text-sm font-bold">المبلغ المحصل</span>
                            <span className="text-xl font-black font-mono" dir="ltr">{formatCurrency(order.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t-2 border-green-300">
                            <span className="text-sm font-bold">الرصيد المتبقي</span>
                            <span className={`text-2xl font-black font-mono ${order.remainingAmount > 0 ? 'text-red-600' : 'text-gray-500'}`} dir="ltr">
                                {formatCurrency(order.remainingAmount)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-gray-300 text-center">
                    <p className="text-xs text-gray-500">
                        {settings?.printFooter || 'شكراً لثقتكم'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                        تم إنشاء هذا المستند تلقائياً • {new Date().toLocaleDateString('ar-EG')}
                    </p>
                </div>
            </div>
        </div>
    );
}
