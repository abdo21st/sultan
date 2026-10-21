import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PERMISSIONS } from "@/lib/permissions";
import { CLOSED_ORDER_STATUSES, ORDER_STATUS } from "@/lib/constants";
import OrderAdjustments from './OrderAdjustments';
import { adjustmentResponse } from '@/lib/order-adjustments';
import OrderActions from "./OrderActions";
import RevokeShares from "./RevokeShares";
import { ArrowLeft, Edit } from "lucide-react";
import { getStatusInfo, formatCurrency, formatDate } from "@/lib/utils";
import AnimatedOrderImage from "@/app/components/ui/AnimatedOrderImage";
import { canAccessOrderFacility, canViewOrderStatus, getRequestUser } from "@/lib/request-user";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getRequestUser();
    if (!user?.permissions.includes(PERMISSIONS.ORDERS_VIEW)) return notFound();
    const canViewFinancials = user.role === 'ADMIN' || user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS);

    const order = await prisma.order.findUnique({
        where: { id },
        select: {
            id: true,
            serialNumber: true,
            customerName: true,
            customerPhone: true,
            description: true,
            status: true,
            dueDate: true,
            createdAt: true,
            factoryId: true,
            shopId: true,
            images: true,
            rejectionReason: true,
            adjustments: { orderBy: { requestedAt: 'desc' }, take: 50 },
            totalAmount: canViewFinancials,
            paidAmount: canViewFinancials,
            remainingAmount: canViewFinancials,
        },
    });

    if (!order || !canAccessOrderFacility(user, order) || !canViewOrderStatus(user, order.status)) return notFound();

    const { adjustments, ...orderFields } = order;
    const currentOrder = {
        ...orderFields,
        totalAmount: Number(order.totalAmount ?? 0),
        paidAmount: Number(order.paidAmount ?? 0),
        remainingAmount: Number(order.remainingAmount ?? 0),
    };

    const statusInfo = getStatusInfo(currentOrder.status);
    const adjustmentOpen = order.adjustments.some(item => item.status === 'REQUESTED' || item.status === 'APPROVED');
    const closed = CLOSED_ORDER_STATUSES.includes(order.status);

    // Fetch facility names
    const factory = currentOrder.factoryId ? await prisma.facility.findUnique({ where: { id: currentOrder.factoryId } }) : null;
    const shop = currentOrder.shopId ? await prisma.facility.findUnique({ where: { id: currentOrder.shopId } }) : null;
    const transactions = canViewFinancials ? await prisma.transaction.findMany({
        where: { orderId: id },
        include: { reversedBy: { select: { id: true } } },
        orderBy: { date: 'desc' }
    }) : [];

    return (
        <div className="min-h-full bg-background pb-32 selection:bg-primary/30 antialiased">
            <header className="bg-background border-b border-border px-4 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/" aria-label="العودة إلى الطلبات" className="p-3 bg-card hover:bg-primary/10 rounded-xl transition-all duration-300 border border-border hover:border-primary/20 group">
                            <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-semibold text-gradient-gold ">الطلب #{currentOrder.serialNumber}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-xs uppercase font-bold  text-muted-foreground">{formatDate(currentOrder.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    {user.permissions.includes(PERMISSIONS.ORDERS_EDIT) && !adjustmentOpen && (
                        <Link href={`/orders/${id}/edit`} aria-label="تعديل الطلب" className="p-3 bg-card hover:bg-primary rounded-xl transition-all duration-300 border border-border group">
                            <Edit className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                        </Link>
                    )}
                </div>

            </header>

            <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
                {/* Status Bar */}
                <div className="bg-card rounded-xl p-6 border border-border flex flex-wrap gap-4 items-center justify-between ">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <div className="w-3 h-3 rounded-full bg-primary " />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase ">الحالة الحالية للنظام</p>
                            <span className={`inline-block mt-1 px-4 py-1 rounded-lg text-xs font-semibold uppercase  border ${statusInfo.color} border-current/20 `}>
                                {statusInfo.label}
                            </span>
                        </div>
                    </div>
                </div>

                <OrderAdjustments orderId={id} orderStatus={order.status} permissions={user.permissions} items={adjustments.map(item => ({ ...adjustmentResponse(item, canViewFinancials), requestedAt: item.requestedAt.toISOString() }))} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Details */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Customer Card */}
                        <div className="bg-card rounded-xl p-8 border border-border ">
                            <h3 className="text-sm font-semibold text-gradient-gold uppercase  mb-6 flex items-center gap-2">
                                <div className="w-1 h-4 bg-primary rounded-full transition-all group-hover:h-6" />
                                بيانات العميل الملكي
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-muted-foreground uppercase ">اسم العميل</p>
                                    <p className="text-lg font-semibold text-foreground">{currentOrder.customerName}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-muted-foreground uppercase ">رقم التواصل</p>
                                    <p className="text-lg font-semibold text-foreground font-mono er" dir="ltr">{currentOrder.customerPhone}</p>
                                </div>
                            </div>
                        </div>

                        {/* Order Info */}
                        <div className="bg-card rounded-xl p-8 border border-border ">
                            <h3 className="text-sm font-semibold text-gradient-gold uppercase  mb-6 flex items-center gap-2">
                                <div className="w-1 h-4 bg-primary rounded-full" />
                                تفاصيل التصميم والتجهيز
                            </h3>
                            <div className="p-6 bg-background rounded-xl border border-border">
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap antialiased font-medium">{currentOrder.description}</p>
                            </div>

                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-muted-foreground uppercase ">جهة التكليف (المعرض)</p>
                                    <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 " />
                                        <p className="text-sm font-semibold text-foreground">{shop?.name || '-'}</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-muted-foreground uppercase ">جهة التنفيذ (المصنع)</p>
                                    <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
                                        <div className="w-2 h-2 rounded-full bg-orange-500 " />
                                        <p className="text-sm font-semibold text-foreground">{factory?.name || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Images */}
                        {currentOrder.images && (currentOrder.images as string[]).length > 0 && (
                            <div className="bg-card rounded-xl p-8 border border-border ">
                                <h3 className="text-sm font-semibold text-gradient-gold uppercase  mb-6 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    المرفقات البصرية
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {(currentOrder.images as string[]).map((_, idx: number) => (
                                        <AnimatedOrderImage key={idx} src={`/api/orders/${id}/images/${idx}`} index={idx} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Financials & Actions */}
                    <div className="space-y-8">
                        {canViewFinancials && (
                            <div className="bg-card rounded-xl p-8 border border-border">
                                <h3 className="text-sm font-semibold text-gradient-gold uppercase  mb-6 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    الملخص المالي
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-xs font-bold text-muted-foreground uppercase ">{closed ? 'القيمة الأصلية قبل الإغلاق' : 'القيمة الإجمالية'}</span>
                                        <span className="text-xl font-semibold font-mono text-foreground" dir="ltr">{formatCurrency(currentOrder.totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-green-500/5 p-4 rounded-xl border border-green-500/10">
                                        <span className="text-xs font-semibold text-green-500 uppercase ">{closed ? 'الدفعات الأصلية قبل الرد' : 'المبلغ المحصل'}</span>
                                        <span className="text-xl font-semibold font-mono text-green-500" dir="ltr">{formatCurrency(currentOrder.paidAmount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-xs font-bold text-muted-foreground uppercase ">{closed ? 'الرصيد الأصلي الملغى تحصيله' : 'الرصيد المتبقي'}</span>
                                        <span className={`text-2xl font-semibold font-mono ${currentOrder.remainingAmount > 0 ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'text-zinc-500'}`} dir="ltr">
                                            {formatCurrency(currentOrder.remainingAmount)}
                                        </span>
                                    </div>
                                </div>
                                {/* Payment History Section */}
                                {[ORDER_STATUS.COMPLETED, 'COMPLETED'].includes(currentOrder.status) && currentOrder.remainingAmount > 0 && (
                                    <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">تم تسليم الطلب، وما زال المبلغ المتبقي مستحقاً. يمكن تسجيل تحصيله من صفحة الحركات المالية.</p>
                                )}
                                {transactions.length > 0 && (
                                    <div className="mt-12 border-t border-border pt-8">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase  mb-6">سجل الدفعات المالية</h4>
                                        <div className="space-y-4">
                                            {transactions.map((t) => (
                                                <div key={t.id} className="flex justify-between items-center p-4 bg-background border border-border rounded-xl">
                                                    <div>
                                                        <p className="text-xs font-bold text-muted-foreground uppercase">{formatDate(t.date)}</p>
                                                        <p className="text-sm font-bold text-foreground">{t.category === 'ORDER_REFUND' ? 'رد مبلغ للعميل' : t.category}</p>
                                                        {t.reversalOfId && <p className="text-xs text-muted-foreground">قيد عكسي — {t.reversalReason}</p>}
                                                        {t.reversedBy && <p className="text-xs text-muted-foreground">حركة معكوسة مع حفظ الأصل</p>}
                                                    </div>
                                                    <span className={`text-sm font-semibold ${(t.type === 'EXPENSE' ? -Number(t.amount) : Number(t.amount)) < 0 ? 'text-red-600' : 'text-green-600'}`} dir="ltr">{formatCurrency(t.type === 'EXPENSE' ? -Number(t.amount) : Number(t.amount))}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            {!adjustmentOpen && <OrderActions order={currentOrder} currentUser={user} />}
                        </div>
                        {(user.permissions.includes(PERMISSIONS.ORDERS_REVOKE_SHARES) || (canViewFinancials && user.permissions.includes(PERMISSIONS.ORDERS_SHARE))) && (
                            <RevokeShares orderId={id} canIssue={canViewFinancials && user.permissions.includes(PERMISSIONS.ORDERS_SHARE)} canRevoke={user.permissions.includes(PERMISSIONS.ORDERS_REVOKE_SHARES)} />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
