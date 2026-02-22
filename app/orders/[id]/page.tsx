import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { PERMISSIONS } from "@/lib/permissions";
import OrderActions from "./OrderActions";
import { ArrowLeft, Edit } from "lucide-react";
import { getStatusInfo, formatCurrency, formatDate } from "@/lib/utils";
import AnimatedOrderImage from "@/app/components/ui/AnimatedOrderImage";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    const order = await prisma.order.findUnique({
        where: { id },
    });

    if (!order) return notFound();

    // After this point, order is guaranteed to exist
    const currentOrder = order!;

    // Check Status Permission
    const userPermissions = session?.user?.permissions || [];
    const isMaster = (session?.user as { username?: string })?.username === 'master';

    if (!isMaster) {
        // If user is not master, they must have permission for the specific status
        // Normalize status for permission check
        // Handle both "orders:status:registered" -> "registered" AND "REGISTERED" -> "registered"
        let statusSuffix = currentOrder.status.replace('orders:status:', '').toLowerCase();

        // Map legacy values if needed (though toLowerCase covers most, explicit mapping is safer if keys differ)
        const LEGACY_MAP: Record<string, string> = {
            'review_needed': 'review',
            'transferred_to_shop': 'shop_ready'
        };
        if (LEGACY_MAP[statusSuffix]) statusSuffix = LEGACY_MAP[statusSuffix];

        const requiredPermission = `orders:status:view:${statusSuffix}`;

        // Check if user has permission for the current order status
        // Admins/Managers have these in DEFAULT_ROLES.
        if (!userPermissions.includes(requiredPermission)) {
            // Return a friendly unauthorized component or redirect?
            // Next.js doesn't have a built-in 403 page easily accessible via a function like notFound()
            // But we can render an error message.
            return (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="text-center p-8 bg-card rounded-2xl border border-border">
                        <h1 className="text-xl font-bold text-destructive mb-2">عذراً، ليس لديك صلاحية لعرض هذا الطلب</h1>
                        <p className="text-muted-foreground">حالة الطلب الحالية لا تسمح لك بالوصول إليه.</p>
                        <Link href="/" className="inline-block mt-4 text-primary hover:underline">العودة للقائمة</Link>
                    </div>
                </div>
            );
        }
    }

    const statusInfo = getStatusInfo(currentOrder.status);

    // Fetch facility names
    const factory = currentOrder.factoryId ? await prisma.facility.findUnique({ where: { id: currentOrder.factoryId } }) : null;
    const shop = currentOrder.shopId ? await prisma.facility.findUnique({ where: { id: currentOrder.shopId } }) : null;
    const transactions = await prisma.transaction.findMany({
        where: { orderId: id },
        orderBy: { date: 'desc' }
    });

    return (
        <div className="min-h-screen bg-background pb-32 selection:bg-primary/30 antialiased">
            <header className="bg-background/80 backdrop-blur-md border-b border-border px-4 py-6 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="p-3 bg-card hover:bg-primary/10 rounded-2xl transition-all duration-300 border border-border hover:border-primary/20 group">
                            <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-gradient-gold tracking-tight">الطلب #{currentOrder.serialNumber}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">{formatDate(currentOrder.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    {session?.user?.permissions?.includes('orders:edit') && (
                        <Link href={`/orders/${id}/edit`} className="p-3 bg-card hover:bg-primary rounded-2xl transition-all duration-300 border border-border group">
                            <Edit className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                        </Link>
                    )}
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
                {/* Status Bar */}
                <div className="bg-card rounded-2xl p-6 border border-border flex flex-wrap gap-4 items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(217,119,6,0.5)]" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">الحالة الحالية للنظام</p>
                            <span className={`inline-block mt-1 px-4 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${statusInfo.color} border-current/20 shadow-sm`}>
                                {statusInfo.label}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Details */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Customer Card */}
                        <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
                            <h3 className="text-sm font-black text-gradient-gold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <div className="w-1 h-4 bg-primary rounded-full transition-all group-hover:h-6" />
                                بيانات العميل الملكي
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">اسم العميل</p>
                                    <p className="text-lg font-black text-foreground">{currentOrder.customerName}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">رقم التواصل</p>
                                    <p className="text-lg font-black text-foreground font-mono tracking-tighter" dir="ltr">{currentOrder.customerPhone}</p>
                                </div>
                            </div>
                        </div>

                        {/* Order Info */}
                        <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
                            <h3 className="text-sm font-black text-gradient-gold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <div className="w-1 h-4 bg-primary rounded-full" />
                                تفاصيل التصميم والتجهيز
                            </h3>
                            <div className="p-6 bg-background rounded-2xl border border-border">
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap antialiased font-medium">{currentOrder.description}</p>
                            </div>

                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">جهة التكليف (المعرض)</p>
                                    <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                        <p className="text-sm font-black text-foreground">{shop?.name || '-'}</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">جهة التنفيذ (المصنع)</p>
                                    <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
                                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                        <p className="text-sm font-black text-foreground">{factory?.name || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Images */}
                        {currentOrder.images && (currentOrder.images as string[]).length > 0 && (
                            <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
                                <h3 className="text-sm font-black text-gradient-gold uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    المرفقات البصرية
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {(currentOrder.images as string[]).map((img: string, idx: number) => (
                                        <AnimatedOrderImage key={idx} src={img} index={idx} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Financials & Actions */}
                    <div className="space-y-8">
                        {(session?.user?.role === 'ADMIN' || session?.user?.permissions?.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS)) && (
                            <div className="bg-card rounded-2xl p-8 border border-border shadow-sm sticky top-28">
                                <h3 className="text-sm font-black text-gradient-gold uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    الملخص المالي
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">القيمة الإجمالية</span>
                                        <span className="text-xl font-black font-mono text-foreground" dir="ltr">{formatCurrency(currentOrder.totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-green-500/5 p-4 rounded-xl border border-green-500/10">
                                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">المبلغ المحصل</span>
                                        <span className="text-xl font-black font-mono text-green-500" dir="ltr">{formatCurrency(currentOrder.paidAmount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">الرصيد المتبقي</span>
                                        <span className={`text-2xl font-black font-mono ${currentOrder.remainingAmount > 0 ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'text-zinc-500'}`} dir="ltr">
                                            {formatCurrency(currentOrder.remainingAmount)}
                                        </span>
                                    </div>
                                </div>
                                {/* Payment History Section */}
                                {transactions.length > 0 && (
                                    <div className="mt-12 border-t border-border pt-8">
                                        <h4 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-6">سجل الدفعات المالية</h4>
                                        <div className="space-y-4">
                                            {transactions.map((t) => (
                                                <div key={t.id} className="flex justify-between items-center p-4 bg-background border border-border rounded-xl">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase">{formatDate(t.date)}</p>
                                                        <p className="text-sm font-bold text-foreground">{t.category}</p>
                                                    </div>
                                                    <span className="text-sm font-black text-green-600" dir="ltr">+{formatCurrency(t.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!(session?.user?.role === 'ADMIN' || session?.user?.permissions?.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS)) && (
                            <div className="sticky top-28">
                                <OrderActions order={currentOrder} currentUser={session?.user} />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
