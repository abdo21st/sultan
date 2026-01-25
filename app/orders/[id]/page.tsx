import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import OrderActions from "./OrderActions";
import { ArrowLeft, Edit } from "lucide-react";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    const order = await prisma.order.findUnique({
        where: { id },
    });

    if (!order) notFound();

    // Fetch facility names
    const factory = order.factoryId ? await prisma.facility.findUnique({ where: { id: order.factoryId } }) : null;
    const shop = order.shopId ? await prisma.facility.findUnique({ where: { id: order.shopId } }) : null;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black pb-20">
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/orders" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">الطلب #{order.serialNumber}</h1>
                            <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("ar-EG")}</span>
                        </div>
                    </div>
                    <Link href={`/orders/${id}/edit`} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-primary">
                        <Edit className="w-5 h-5" />
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 space-y-6">
                {/* Status Bar */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">الحالة الحالية:</span>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold">
                            {/* Map status to Arabic - duplicated logic, ideally utility */}
                            {order.status === 'REGISTERED' ? 'قيد التسجيل' :
                                order.status === 'TRANSFERRED_TO_FACTORY' ? 'قيد التحويل للمصنع' :
                                    order.status === 'PROCESSING' ? 'قيد التجهيز' :
                                        order.status === 'TRANSFERRED_TO_SHOP' ? 'جاهز للاستلام' :
                                            order.status === 'DELIVERING' ? 'قيد التسليم' :
                                                order.status === 'COMPLETED' ? 'مكتمل' :
                                                    order.status === 'REVIEW_NEEDED' ? 'مراجعة مطلوبة' : order.status}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Details */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Customer Card */}
                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-semibold mb-4 text-foreground border-b border-border pb-2">بيانات العميل</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">الاسم</p>
                                    <p className="font-medium text-foreground">{order.customerName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">رقم الهاتف</p>
                                    <p className="font-medium text-foreground font-mono" dir="ltr">{order.customerPhone}</p>
                                </div>
                            </div>
                        </div>

                        {/* Order Info */}
                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-semibold mb-4 text-foreground border-b border-border pb-2">تفاصيل الطلب</h3>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{order.description}</p>

                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">المصدر (المعرض)</p>
                                    <p className="text-sm font-medium">{shop?.name || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">الوجهة (المصنع)</p>
                                    <p className="text-sm font-medium">{factory?.name || '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Images */}
                        {order.images && order.images.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                                <h3 className="font-semibold mb-4 text-foreground border-b border-border pb-2">المرفقات</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {order.images.map((img, idx) => (
                                        <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block w-full h-32 rounded-lg overflow-hidden border border-border">
                                            <img src={img} alt={`Order ${idx}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Financials & Actions */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-semibold mb-4 text-foreground border-b border-border pb-2">المالية</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">الإجمالي</span>
                                    <span className="font-bold font-mono" dir="ltr">{order.totalAmount.toLocaleString()} د.ل</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">المدفوع</span>
                                    <span className="font-bold text-green-600 font-mono" dir="ltr">{order.paidAmount.toLocaleString()} د.ل</span>
                                </div>
                                <div className="flex justify-between border-t border-dashed border-border pt-2">
                                    <span className="text-sm font-medium">المتبقي</span>
                                    <span className={`font-bold font-mono ${order.remainingAmount > 0 ? 'text-red-500' : 'text-zinc-500'}`} dir="ltr">
                                        {order.remainingAmount.toLocaleString()} د.ل
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ACTION BUTTONS COMPONENT */}
                        <OrderActions order={order} currentUser={session?.user} />

                    </div>
                </div>
            </main>
        </div>
    );
}
