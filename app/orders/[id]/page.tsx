import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PERMISSIONS } from "@/lib/permissions";
import { CLOSED_ORDER_STATUSES, ORDER_STATUS, PRIMARY_ORDER_STATUSES, ORDER_STATUS_LABELS, normalizeOrderStatus } from "@/lib/constants";
import OrderAdjustments from './OrderAdjustments';
import { adjustmentResponse } from '@/lib/order-adjustments';
import OrderActions from "./OrderActions";
import RevokeShares from "./RevokeShares";
import { ArrowRight, CalendarDays, Check, ChevronDown, Edit3, Factory, FileText, ImageIcon, Store, User, Wallet } from "lucide-react";
import OrderStatusBadge from "@/app/components/OrderStatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
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
            reviewRequired: true,
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

    const phaseIndex = PRIMARY_ORDER_STATUSES.findIndex(phase => phase === normalizeOrderStatus(order.status));
    const pendingAdjustment = adjustments.some(item => item.status === "REQUESTED");
    const canRequestAdjustment = [PERMISSIONS.ORDERS_ADJUSTMENT_REQUEST, PERMISSIONS.ORDERS_ADJUSTMENT_APPROVE, PERMISSIONS.ORDERS_REFUND].some(permission => user.permissions.includes(permission));
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

    return <main className="ui-page max-w-6xl space-y-6">
        <header className="ui-page-header">
            <div className="flex min-w-0 items-center gap-3"><Link href="/" className="ui-icon-button" aria-label="العودة إلى الطلبات" title="العودة إلى الطلبات"><ArrowRight size={18} aria-hidden="true" /></Link><div className="min-w-0"><h1 className="ui-page-title">الطلب <bdi>#{currentOrder.serialNumber}</bdi></h1><p className="ui-page-description break-words">{currentOrder.customerName}</p></div></div>
            <div className="flex flex-wrap items-center gap-3"><OrderStatusBadge status={order.status} />{user.permissions.includes(PERMISSIONS.ORDERS_EDIT) && !adjustmentOpen && <Link href={`/orders/${id}/edit`} className="ui-button"><Edit3 size={17} aria-hidden="true" />تعديل الطلب</Link>}</div>
        </header>
        <section className="ui-card flex flex-wrap gap-x-8 gap-y-4 text-sm" aria-label="موعد الطلب والمنشآت"><p className="flex items-center gap-2"><CalendarDays size={18} className="text-primary" aria-hidden="true" /><span className="text-muted-foreground">التسليم</span><strong>{new Date(order.dueDate).toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', day: 'numeric', month: 'long', year: 'numeric' })}</strong></p><p className="flex items-center gap-2"><Store size={18} className="text-primary" aria-hidden="true" /><span className="text-muted-foreground">المحل</span><strong>{shop?.name || 'غير محدد'}</strong></p><p className="flex items-center gap-2"><Factory size={18} className="text-primary" aria-hidden="true" /><span className="text-muted-foreground">المصنع</span><strong>{factory?.name || 'غير محدد'}</strong></p></section>
        {!closed && <ol className="order-stage-list" aria-label="مراحل الطلب الأربع">{PRIMARY_ORDER_STATUSES.map((phase, index) => <li key={phase} aria-current={index === phaseIndex ? 'step' : undefined} data-done={index < phaseIndex || undefined}><span aria-hidden="true">{index < phaseIndex ? <Check size={16} /> : index + 1}</span>{ORDER_STATUS_LABELS[phase]}</li>)}</ol>}
        {order.reviewRequired && <section className="ui-feedback border-amber-400 bg-amber-50" role="status"><div className="flex-1 space-y-2"><h2 className="font-bold text-amber-900">يحتاج تصحيحاً</h2><p className="text-sm whitespace-pre-wrap">{order.rejectionReason || 'راجع بيانات الطلب مع المصنع.'}</p><p className="text-xs text-muted-foreground">تبقى مرحلة الطلب محفوظة، ويُشعر المصنع بعد حفظ التصحيح.</p></div>{user.permissions.includes(PERMISSIONS.ORDERS_EDIT) && !adjustmentOpen && <Link className="ui-button" href={`/orders/${id}/edit`}>تصحيح بيانات الطلب</Link>}</section>}
        {adjustments.length > 0 && <OrderAdjustments orderId={id} orderStatus={order.status} permissions={user.permissions} items={adjustments.map(item => ({ ...adjustmentResponse(item, canViewFinancials), requestedAt: item.requestedAt.toISOString() }))} />}
        {!pendingAdjustment && <OrderActions order={currentOrder} currentUser={user} />}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
            <div className="min-w-0 space-y-6">
                <section className="ui-card order-detail-section"><h2><User size={18} className="text-primary" aria-hidden="true" />بيانات العميل</h2><dl className="grid grid-cols-1 sm:grid-cols-2 gap-5"><div><dt className="text-xs text-muted-foreground">اسم العميل</dt><dd className="mt-2 font-semibold break-words">{currentOrder.customerName}</dd></div><div><dt className="text-xs text-muted-foreground">رقم التواصل</dt><dd className="mt-2 font-semibold"><bdi>{currentOrder.customerPhone}</bdi></dd></div></dl><p className="mt-4 text-xs text-muted-foreground">سُجّل في {formatDate(currentOrder.createdAt)}</p></section>
                <section className="ui-card order-detail-section"><h2><FileText size={18} className="text-primary" aria-hidden="true" />مواصفات الطلب</h2><p className="text-sm leading-loose whitespace-pre-wrap break-words">{currentOrder.description}</p></section>
                {currentOrder.images.length > 0 && <section className="ui-card order-detail-section"><h2><ImageIcon size={18} className="text-primary" aria-hidden="true" />صور الطلب<span className="text-xs font-normal text-muted-foreground">({currentOrder.images.length})</span></h2><div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{currentOrder.images.map((_, index) => <AnimatedOrderImage key={index} src={`/api/orders/${id}/images/${index}`} index={index} />)}</div></section>}
                {!adjustments.length && canRequestAdjustment && <details className="order-adjustment-disclosure"><summary className="flex items-center justify-between gap-3 p-5 cursor-pointer font-semibold text-sm">الإلغاء والمرتجعات<ChevronDown size={18} aria-hidden="true" /></summary><OrderAdjustments orderId={id} orderStatus={order.status} permissions={user.permissions} items={[]} /></details>}
            </div>
            <aside className="min-w-0 space-y-6">
                {canViewFinancials && <section className="ui-card order-detail-section"><h2><Wallet size={18} className="text-primary" aria-hidden="true" />الملخص المالي</h2><dl className="space-y-5"><div className="flex flex-wrap justify-between gap-2"><dt className="text-xs text-muted-foreground">{closed ? 'القيمة الأصلية قبل الإغلاق' : 'قيمة الطلب'}</dt><dd className="font-semibold"><bdi>{formatCurrency(currentOrder.totalAmount)}</bdi></dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-xs text-muted-foreground">{closed ? 'الدفعات الأصلية قبل الرد' : 'المبلغ المحصل'}</dt><dd className="font-semibold text-emerald-800"><bdi>{formatCurrency(currentOrder.paidAmount)}</bdi></dd></div><div className="rounded-xl bg-muted p-4 space-y-2"><dt className="text-xs text-muted-foreground">{closed ? 'الرصيد الأصلي الملغى تحصيله' : 'المتبقي للتحصيل'}</dt><dd className={`text-xl font-bold ${!closed && currentOrder.remainingAmount > 0 ? 'text-amber-900' : 'text-foreground'}`}><bdi>{formatCurrency(currentOrder.remainingAmount)}</bdi></dd></div></dl>{closed && <p className="text-xs text-muted-foreground leading-relaxed mt-4">الأرقام أعلاه أصلية للتدقيق. المبلغ الواجب رده وتسجيل تسويته يظهران في الإلغاء والمرتجعات.</p>}{normalizeOrderStatus(order.status) === ORDER_STATUS.COMPLETED && currentOrder.remainingAmount > 0 && <p className="mt-4 rounded-lg bg-amber-50 text-amber-900 p-3 text-xs leading-relaxed">تم تسليم الطلب ويبقى الرصيد مستحقاً. يتابع المسؤول المالي تحصيله بشكل مستقل.</p>}{transactions.length > 0 && <details className="mt-5 border-t border-border pt-4"><summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold">سجل الدفعات المالية<span className="text-xs text-muted-foreground">{transactions.length} حركة</span></summary><div className="mt-4 space-y-3">{transactions.map(transaction => <article key={transaction.id} className="rounded-lg bg-background p-3 text-xs space-y-2"><div className="flex flex-wrap justify-between gap-2"><strong>{transaction.category === 'ORDER_REFUND' ? 'رد مبلغ للعميل' : transaction.category === 'SALES' ? 'دفعة طلب' : transaction.category}</strong><bdi className={transaction.type === 'EXPENSE' ? 'text-red-700 font-semibold' : 'text-emerald-800 font-semibold'}>{formatCurrency(transaction.type === 'EXPENSE' ? -Number(transaction.amount) : Number(transaction.amount))}</bdi></div><p className="text-muted-foreground">{formatDate(transaction.date)}</p>{transaction.reversalOfId && <p className="text-muted-foreground break-words">قيد عكسي — {transaction.reversalReason}</p>}{transaction.reversedBy && <p className="text-muted-foreground">حركة معكوسة مع حفظ الأصل</p>}</article>)}</div></details>}</section>}
                {(user.permissions.includes(PERMISSIONS.ORDERS_REVOKE_SHARES) || (canViewFinancials && user.permissions.includes(PERMISSIONS.ORDERS_SHARE))) && <RevokeShares orderId={id} canIssue={canViewFinancials && user.permissions.includes(PERMISSIONS.ORDERS_SHARE)} canRevoke={user.permissions.includes(PERMISSIONS.ORDERS_REVOKE_SHARES)} />}
            </aside>
        </div>
    </main>;
}
