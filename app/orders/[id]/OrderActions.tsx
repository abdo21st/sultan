'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { updateOrderStatus, completeOrder } from '@/lib/actions/orders';
import { Printer, XCircle, CheckCircle, Truck, Package, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { ORDER_STATUS, ORDER_WORKFLOW, ORDER_STATUS_LABELS } from '@/lib/constants';
import { useToast } from '@/app/components/ToastProvider';
import { formatCurrency } from '@/lib/utils';
/* formatCurrency and formatDate are not used in this component */

interface Order {
    id: string;
    serialNumber: number;
    customerName: string;
    customerPhone: string;
    description: string | null;
    status: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    factoryId: string | null;
    shopId: string | null;
    rejectionReason: string | null;
}

interface User {
    id: string;
    displayName?: string | null;
    role: string;
    facilityId?: string | null;
    phoneNumber?: string;
    permissions?: string[];
}

export default function OrderActions({ order, currentUser }: { order: Order, currentUser?: User | null }) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentAmount, setPaymentAmount] = useState(order.remainingAmount?.toString() || '0');

    const handleStatusUpdate = async (newStatus: string, reason?: string) => {
        setLoading(true);
        const res = await updateOrderStatus(order.id, newStatus, reason);
        if (res.success) {
            if (newStatus === ORDER_STATUS.REVIEW) setShowRejectModal(false);
            showToast('تم تحديث حالة الطلب بنجاح', 'success');
        } else {
            showToast(res.error || 'حدث خطأ أثناء التحديث', 'error');
        }
        setLoading(false);
    };

    const handleFinishProcessing = async () => {
        setLoading(true);
        const res = await updateOrderStatus(order.id, ORDER_STATUS.SHOP_READY);
        if (res.success) {
            window.open(`/orders/print/${order.id}`, '_blank');
            showToast('تم تجهيز المستند للطباعة', 'success');
        } else {
            showToast(res.error || 'حدث خطأ أثناء التجهيز', 'error');
        }
        setLoading(false);
    };

    const handleComplete = async () => {
        setLoading(true);
        const res = await completeOrder(order.id, parseFloat(paymentAmount || '0'), paymentNote);
        if (res.success) {
            setShowPaymentModal(false);
            showToast('تم إتمام التسليم والتحصيل بنجاح', 'success');
        } else {
            showToast(res.error || 'حدث خطأ أثناء إتمام العملية', 'error');
        }
        setLoading(false);
    };


    if (order.status === ORDER_STATUS.COMPLETED) return null;

    return (
        <div className="bg-[#0f172a] rounded-xl p-8 border border-slate-800 ">
            <h3 className="text-xs font-semibold text-amber-500 uppercase  mb-6 border-b border-slate-800 pb-4">الإجراءات والعمليات الفورية</h3>

            <div className="flex flex-col gap-4">
                <Link
                    href={`/orders/print/${order.id}`}
                    target="_blank"
                    className="w-full py-4 bg-slate-900 text-slate-300 rounded-xl font-semibold text-xs uppercase  hover:bg-slate-800 hover:text-white transition-all duration-300 border border-slate-800 flex items-center justify-center gap-3  "
                >
                    <Printer className="w-4 h-4 text-amber-500" />
                    طباعة المستند الرسمي
                </Link>

                {/* Dynamic Sequential Actions */}
                {ORDER_WORKFLOW[order.status as keyof typeof ORDER_WORKFLOW]?.map((nextStatus: string) => {
                    const statusSuffix = nextStatus.replace('orders:status:', '');
                    const changePermission = `orders:status:change:${statusSuffix}`;

                    const hasPermission = currentUser?.role === 'ADMIN' || currentUser?.permissions?.includes(changePermission);
                    const canCollectPayment = currentUser?.role === 'ADMIN' || (
                        currentUser?.permissions?.includes('orders:view_financials') &&
                        currentUser?.permissions?.includes('transactions:add')
                    );

                    if (!hasPermission || (nextStatus === ORDER_STATUS.COMPLETED && !canCollectPayment)) return null;

                    if (nextStatus === ORDER_STATUS.PROCESSING) {
                        return (
                            <button
                                key={nextStatus}
                                onClick={() => handleStatusUpdate(nextStatus)}
                                disabled={loading}
                                className="w-full py-5 bg-gradient-to-br from-amber-600 to-amber-900 text-white rounded-xl font-semibold text-xs uppercase      transition-all duration-500 flex items-center justify-center gap-3"
                            >
                                <RefreshCw className="w-5 h-5 animate-spin-slow" />
                                استلام وبدء التجهيز
                            </button>
                        );
                    }

                    if (nextStatus === ORDER_STATUS.REVIEW) {
                        return (
                            <button
                                key={nextStatus}
                                onClick={() => setShowRejectModal(true)}
                                disabled={loading}
                                className="w-full py-5 bg-red-950/30 text-red-500 border-2 border-red-900/50 rounded-xl font-semibold text-xs uppercase  hover:bg-red-900/20 transition-all duration-300 flex items-center justify-center gap-3 "
                            >
                                <XCircle className="w-5 h-5" />
                                إعادة للمراجعة الفنية
                            </button>
                        );
                    }

                    if (nextStatus === ORDER_STATUS.SHOP_READY) {
                        return (
                            <button
                                key={nextStatus}
                                onClick={handleFinishProcessing}
                                disabled={loading}
                                className="w-full py-5 bg-indigo-950/30 text-indigo-400 border-2 border-indigo-900/50 rounded-xl font-semibold text-xs uppercase  hover:bg-indigo-900/20 transition-all duration-300 flex items-center justify-center gap-3  "
                            >
                                <Package className="w-5 h-5" />
                                إرسال للمعرض (جاهز)
                            </button>
                        );
                    }

                    if (nextStatus === ORDER_STATUS.COMPLETED) {
                        return (
                            <button
                                key={nextStatus}
                                onClick={() => setShowPaymentModal(true)}
                                disabled={loading}
                                className="w-full py-5 bg-gradient-to-br from-green-600 to-green-900 text-white rounded-xl font-semibold text-xs uppercase   transition-all duration-300 flex items-center justify-center gap-3   "
                            >
                                <CheckCircle className="w-5 h-5" />
                                إتمام التسليم والدفع
                            </button>
                        );
                    }

                    return (
                        <button
                            key={nextStatus}
                            onClick={() => handleStatusUpdate(nextStatus)}
                            disabled={loading}
                            className="w-full py-5 bg-slate-900 text-slate-300 rounded-xl font-semibold text-xs uppercase  border border-slate-800 hover:bg-slate-800 hover:text-white transition-all duration-300 flex items-center justify-center gap-3 "
                        >
                            {nextStatus === ORDER_STATUS.DELIVERING ? <Truck className="w-5 h-5 text-amber-500" /> : <Package className="w-5 h-5 text-amber-500" />}
                            {ORDER_STATUS_LABELS[nextStatus as keyof typeof ORDER_STATUS_LABELS]}
                        </button>
                    );
                })}

                {/* Edit for Review State */}
                {order.status === ORDER_STATUS.REVIEW && (
                    <Link
                        href={`/orders/${order.id}/edit`}
                        className="w-full py-5 bg-amber-950/30 text-amber-500 border-2 border-amber-900/50 rounded-xl font-semibold text-xs uppercase  hover:bg-amber-900/20 transition-all duration-300 flex items-center justify-center gap-3 "
                    >
                        تعديل للمراجعة
                    </Link>
                )}
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-500">
                    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-12 w-full max-w-xl  relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />

                        <h3 className="text-3xl font-semibold text-white  mb-2">إعادة للمراجعة</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase  mb-10">يرجى توضيح سبب الرفض أو الملاحظات الفنية للسلطان.</p>

                        <div className="mb-10">
                            <textarea
                                className="w-full h-48 p-6 bg-slate-950 border-2 border-slate-800 rounded-xl text-sm font-bold text-slate-300 focus:border-red-500/50 focus:ring-0 outline-none transition-all duration-300 resize-none "
                                placeholder="اكتب تفاصيل المراجعة الفنية هنا..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handleStatusUpdate(ORDER_STATUS.REVIEW, rejectReason)}
                                disabled={loading || !rejectReason}
                                className="flex-[2] py-5 bg-gradient-to-br from-red-600 to-red-900 text-white rounded-xl font-semibold text-[12px] uppercase      disabled:opacity-50 transition-all duration-300"
                            >
                                تأكيد الإعادة الفنية
                            </button>
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 py-5 bg-slate-900 text-slate-400 rounded-xl font-semibold text-xs uppercase  border border-slate-800 hover:bg-slate-800 hover:text-white transition-all"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-500">
                    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-12 w-full max-w-xl  relative overflow-hidden">
                        {/* Decorative subtle gradient for matte feel */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h3 className="text-3xl font-semibold text-white ">إتمام التحصيل</h3>
                                <p className="text-xs font-bold text-slate-500 uppercase  mt-2">تأكيد استلام المبلغ المتبقي للسلطان.</p>
                            </div>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="w-10 h-10 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-full text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                            >✕</button>
                        </div>

                        <div className="bg-slate-900/40 p-10 rounded-xl mb-10 border border-slate-800/50 group hover:border-amber-500/20 transition-all duration-500">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase ">المبلغ المكتوب فى الإيصال</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-semibold text-amber-500 font-mono er" dir="ltr">
                                        {formatCurrency(order.remainingAmount)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-10 space-y-4">
                            <label className="text-xs font-semibold text-slate-500 uppercase  flex items-center gap-2 px-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                المبلغ المقبوض فعلياً
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl p-6 text-2xl font-semibold font-mono text-green-400 focus:border-amber-500/50 focus:ring-0 outline-none transition-all duration-300 placeholder:text-slate-800 "
                                    placeholder="0.00"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                />
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 font-bold text-xs uppercase">دينار</span>
                            </div>
                        </div>

                        <div className="mb-12 space-y-4">
                            <label className="text-xs font-semibold text-slate-500 uppercase  flex items-center gap-2 px-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                ملاحظات التحصيل والتحقق
                            </label>
                            <textarea
                                className="w-full h-32 p-6 bg-slate-950 border-2 border-slate-800 rounded-xl text-sm font-bold text-slate-300 focus:border-amber-500/50 outline-none transition-all duration-300 resize-none "
                                placeholder="دون ملاحظاتك هنا..."
                                value={paymentNote}
                                onChange={(e) => setPaymentNote(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="flex-[2.5] py-5 bg-gradient-to-br from-amber-600 to-amber-900 text-white rounded-xl font-semibold text-[12px] uppercase      disabled:opacity-50 transition-all duration-300"
                            >
                                {loading ? 'جاري المعالجة...' : 'تأكيد ودفع الاستحقاق'}
                            </button>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 py-5 bg-slate-900 text-slate-400 rounded-xl font-semibold text-xs uppercase  border border-slate-800 hover:bg-slate-800 hover:text-white transition-all"
                            >
                                رجوع
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
