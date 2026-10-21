import { prisma } from "../../../../lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import PrintAndShareButtons from "../../../components/PrintAndShareButtons";
import QRCode from "qrcode";
import { formatCurrency } from "../../../../lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import { canAccessOrderFacility, canViewOrderStatus, getRequestUser } from "@/lib/request-user";
import { issueOrderShareToken } from "@/lib/order-sharing";
import { CLOSED_ORDER_STATUSES, ORDER_STATUS_LABELS } from '@/lib/constants';

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [order, settings, user] = await Promise.all([
        prisma.order.findUnique({
            where: { id },
            include: {
                factory: true,
                shop: true,
                adjustments: { where: { status: 'APPROVED' }, take: 1 },
            }
        }),
        prisma.systemSettings.findFirst(),
        getRequestUser()
    ]);

    if (
        !user?.permissions.includes(PERMISSIONS.ORDERS_VIEW) ||
        !(user.role === 'ADMIN' || user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS)) ||
        !order ||
        !canAccessOrderFacility(user, order) ||
        !canViewOrderStatus(user, order.status)
    ) return notFound();
    const currentOrder = order!;
    const closed = CLOSED_ORDER_STATUSES.includes(currentOrder.status);
    const adjustment = currentOrder.adjustments[0];
    const refundRemaining = adjustment ? Number(adjustment.refundAmount.minus(adjustment.refundedAmount)) : 0;

    const canViewFinancials = true;

    // Generate QR Code data (linking to the digital order page)
    const configuredBaseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
    const baseUrl = configuredBaseUrl || (process.env.NODE_ENV === 'development' ? "http://localhost:3000" : null);
    if (!baseUrl) throw new Error("AUTH_URL must be configured with the public application URL.");
    const parsedBaseUrl = new URL(baseUrl);
    if (process.env.NODE_ENV === 'production' && parsedBaseUrl.protocol !== 'https:') {
        throw new Error("AUTH_URL must use HTTPS in production.");
    }
    const shareUrl = new URL(`/orders/share/${currentOrder.id}`, baseUrl);
    const token = await issueOrderShareToken(currentOrder.id, user, 'PRINT');
    if (!token) return notFound();
    shareUrl.searchParams.set("token", token);
    const orderUrl = shareUrl.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(orderUrl, {
        margin: 1,
        width: 120,
        color: {
            dark: "#000000",
            light: "#ffffff"
        }
    });

    return (
        <div className="p-8 max-w-4xl mx-auto bg-white text-black min-h-screen relative" id="print-area">
            {/* Decorative Gold Header Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-stone-700 via-stone-400 to-stone-700 no-print" />

            {/* Header */}
            <div className="flex justify-between items-center border-b-4 border-stone-600/20 pb-8 mb-10 mt-4">
                <div className="flex items-center gap-6">
                    {settings?.logoUrl ? (
                        <div className="relative w-24 h-24 border-2 border-stone-600/10 rounded-2xl p-2 shadow-sm">
                            <Image src={settings.logoUrl} alt="Logo" fill className="object-contain" />
                        </div>
                    ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-stone-600 to-stone-900 rounded-2xl flex items-center justify-center text-white font-black text-4xl shadow-sm">
                            {settings?.appName?.[0] || 'س'}
                        </div>
                    )}
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-zinc-900 tracking-tighter">{settings?.appName || "سلطان"}</h1>
                        <p className="text-sm font-semibold text-zinc-600">مستند طلب · المحلات والمصانع</p>
                        {settings?.printHeader && (
                            <p className="text-sm text-zinc-500 font-medium max-w-sm leading-relaxed mt-2">{settings.printHeader}</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                    <div className="bg-zinc-900 text-white px-6 py-3 rounded-2xl text-center shadow-lg">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">رقم الطلب التسلسلي</p>
                        <p className="text-2xl font-black font-mono">#{currentOrder.serialNumber}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">تاريخ الاستخراج</p>
                        <p className="text-xs font-bold text-zinc-900">{new Date().toLocaleDateString("ar-LY", { dateStyle: 'full' })}</p>
                    </div>
                </div>
            </div>

            {/* Main Info Section */}
            <div className="grid grid-cols-12 gap-10 mb-12">
                <div className="col-span-12 md:col-span-8 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        <section className="space-y-3">
                            <h2 className="text-[10px] font-black text-stone-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-stone-600" />
                                بيانات العميل
                            </h2>
                            <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200/60 shadow-inner">
                                <p className="font-black text-xl text-zinc-900 mb-1">{currentOrder.customerName}</p>
                                <p className="text-zinc-500 font-bold font-mono text-sm tracking-tight" dir="ltr">{currentOrder.customerPhone}</p>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-[10px] font-black text-stone-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-stone-600" />
                                تفاصيل التوقيت والمقر
                            </h2>
                            <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200/60 flex flex-col justify-center gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">التسليم:</span>
                                    <span className="font-black text-zinc-900 text-sm whitespace-nowrap">{new Date(currentOrder.dueDate).toLocaleDateString("ar-LY", { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">المصنع:</span>
                                    <span className="font-black text-stone-700 text-sm">{currentOrder.factory?.name || 'مقر عام'}</span>
                                </div>
                                <div className="flex justify-between items-center"><span className="text-xs text-zinc-500">المحل:</span><span className="font-bold text-sm">{currentOrder.shop.name}</span></div>
                            </div>
                        </section>
                    </div>

                    <section className="space-y-3">
                        <h2 className="text-[10px] font-black text-stone-600 uppercase tracking-[0.2em] flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-stone-600" />
                            تفاصيل الطلب والملاحظات
                        </h2>
                        <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200/60 min-h-[160px] shadow-inner">
                            <p className="text-sm font-medium text-zinc-800 leading-loose whitespace-pre-wrap">{currentOrder.description}</p>
                        </div>
                    </section>
                </div>

                <div className="col-span-12 md:col-span-4 flex flex-col items-center justify-center p-6 bg-stone-50/50 rounded-[2.5rem] border border-stone-200/40">
                    <div className="relative w-36 h-36 bg-white p-3 rounded-3xl shadow-sm mb-4">
                        <Image src={qrCodeDataUrl} alt="Order QR Code" fill className="p-2" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-[11px] font-black text-stone-800 uppercase tracking-widest">امسح الكود للتتبع</p>
                        <p className="text-[9px] font-bold text-stone-600/60 uppercase tracking-tighter">رابط الطلب الرقمي المعتمد</p>
                    </div>
                </div>
            </div>

            <p className="mb-5 font-bold">الحالة: {ORDER_STATUS_LABELS[currentOrder.status] || currentOrder.status}</p>
            {currentOrder.reviewRequired && <p className="mb-5 rounded-xl border p-4 text-sm">يحتاج تصحيحاً: {currentOrder.rejectionReason}</p>}
            {closed && <p className="mb-6 p-4 border rounded-xl text-sm">أُغلق الطلب بإلغاء أو مرتجع. الأرقام أدناه هي السجل الأصلي قبل الإغلاق، ولا يُحصّل الرصيد الأصلي. المتبقي لإعادته للعميل: {formatCurrency(refundRemaining)}.</p>}
            {/* Financial Summary */}
            {canViewFinancials && (
                <div className="bg-zinc-900 text-white rounded-[2rem] p-10 flex flex-wrap justify-between items-center mb-12 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-stone-600/10 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-stone-600/10 rounded-full blur-2xl -ml-10 -mb-10" />

                    <div className="relative">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">إجمالي الالتزام المالي</p>
                        <p className="text-4xl font-black font-mono tracking-tighter" dir="ltr">{formatCurrency(currentOrder.totalAmount)}</p>
                    </div>
                    <div className="relative border-x border-white/10 px-12 group-hover:px-16 transition-all duration-700">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-500 mb-2">ما تم تحصيله</p>
                        <p className="text-4xl font-black font-mono text-green-500 tracking-tighter" dir="ltr">{formatCurrency(currentOrder.paidAmount)}</p>
                    </div>
                    <div className="relative text-left">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 text-right mb-2">{closed ? 'الرصيد الأصلي الملغى تحصيله' : 'الرصيد المتبقي'}</p>
                        <p className="text-4xl font-black font-mono text-red-500 tracking-tighter" dir="ltr">{formatCurrency(currentOrder.remainingAmount)}</p>
                    </div>
                </div>
            )}

            {/* Terms and Signatures */}
            <div className="mt-auto pt-10 grid grid-cols-2 gap-10 items-end">
                <div className="space-y-6">
                    {settings?.printTerms && <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200"><h4 className="text-sm font-bold mb-2">الملاحظات والشروط</h4><p className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed">{settings.printTerms}</p></div>}
                </div>

                <div className="flex flex-col gap-10 items-end">
                    <div className="w-full h-px bg-gradient-to-l from-zinc-200/50 via-zinc-200 to-zinc-200/50" />
                    <div className="flex justify-between w-full text-[10px] items-center">
                        <div className="text-right space-y-2">
                            <p className="font-bold text-zinc-400 uppercase tracking-widest">توقيع المستلم المعتمد</p>
                            <p className="text-lg font-black text-zinc-800">...............................</p>
                        </div>
                        <div className="text-right space-y-2">
                            <p className="font-bold text-zinc-400 uppercase tracking-widest">توقيع محاسب النظام</p>
                            <p className="text-lg font-black text-zinc-800">...............................</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Credits */}
            <div className="mt-12 pt-6 border-t border-zinc-100 flex justify-between items-center">
                <p className="text-xs text-zinc-500">{settings?.appName || 'سلطان'} · إدارة الطلبات</p>
                <div className="text-left">
                    {settings?.printFooter ? (
                        <p className="text-[10px] font-bold text-zinc-500 whitespace-pre-line leading-relaxed">{settings.printFooter}</p>
                    ) : (
                        <p className="text-xs text-zinc-500">شكراً لثقتكم · {new Date().getFullYear()}</p>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0 !important; }
                    #print-area { padding: 40px !important; width: 100% !important; max-width: none !important; margin: 0 !important; box-shadow: none !important; }
                    .shadow-sm, .shadow-2xl, .shadow-lg { box-shadow: none !important; }
                    .bg-zinc-900 { background-color: #18181b !important; -webkit-print-color-adjust: exact; }
                    .text-green-500 { color: #22c55e !important; -webkit-print-color-adjust: exact; }
                    .text-red-500 { color: #ef4444 !important; -webkit-print-color-adjust: exact; }
                    .bg-stone-50\\/50 { background-color: #fffbeb !important; -webkit-print-color-adjust: exact; }
                    .bg-zinc-50 { background-color: #fafafa !important; -webkit-print-color-adjust: exact; }
                }
            `}} />

            <div className="no-print mt-12 flex justify-center">
                <PrintAndShareButtons
                    canViewFinancials={canViewFinancials}
                    orderData={{
                        serialNumber: currentOrder.serialNumber,
                        customerName: currentOrder.customerName,
                        customerPhone: currentOrder.customerPhone,
                        description: currentOrder.description,
                        totalAmount: Number(currentOrder.totalAmount),
                        paidAmount: Number(currentOrder.paidAmount),
                        remainingAmount: Number(currentOrder.remainingAmount),
                        dueDate: currentOrder.dueDate,
                        orderId: currentOrder.id,
                        shareUrl: orderUrl,
                        appName: settings?.appName || 'سلطان',
                        printHeader: settings?.printHeader || '',
                        printFooter: settings?.printFooter || '',
                        printTerms: settings?.printTerms || '',
                        factoryName: currentOrder.factory.name,
                        shopName: currentOrder.shop.name,
                        qrDataUrl: qrCodeDataUrl,
                        closed,
                        statusLabel: ORDER_STATUS_LABELS[currentOrder.status] || currentOrder.status,
                        refundRemaining,
                        correctionReason: currentOrder.reviewRequired ? currentOrder.rejectionReason || 'يحتاج تصحيحاً' : '',
                    }}
                />
            </div>
        </div>
    );
}
