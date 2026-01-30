'use client';

import { useState } from 'react';
import { updateOrderStatus, completeOrder } from '@/lib/actions/orders';
import { Printer, XCircle, CheckCircle, Truck, Package } from 'lucide-react';
import Link from 'next/link';
import { ORDER_STATUS, ORDER_WORKFLOW, ORDER_STATUS_LABELS } from '@/lib/constants';
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
        } else {
            alert(res.error);
        }
        setLoading(false);
    };

    const handleFinishProcessing = async () => {
        setLoading(true);
        const res = await updateOrderStatus(order.id, ORDER_STATUS.SHOP_READY);
        if (res.success) {
            window.open(`/orders/print/${order.id}`, '_blank');
        } else {
            alert(res.error);
        }
        setLoading(false);
    };

    const handleComplete = async () => {
        setLoading(true);
        const res = await completeOrder(order.id, parseFloat(paymentAmount || '0'), paymentNote);
        if (res.success) {
            setShowPaymentModal(false);
        } else {
            alert(res.error);
        }
        setLoading(false);
    };


    if (order.status === ORDER_STATUS.COMPLETED) return null;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-semibold mb-4 text-foreground border-b border-border pb-2">الإجراءات</h3>

            <div className="flex flex-col gap-3">
                <Link
                    href={`/orders/print/${order.id}`}
                    target="_blank"
                    className="w-full py-2 bg-zinc-100 text-zinc-900 rounded-lg font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 mb-2"
                >
                    <Printer className="w-4 h-4" />
                    طباعة تقرير الطلب
                </Link>

                {/* Dynamic Sequential Actions */}
                {ORDER_WORKFLOW[order.status]?.map((nextStatus) => {
                    const hasPermission = currentUser?.role === 'ADMIN' || currentUser?.permissions?.includes(nextStatus);

                    if (!hasPermission) return null;

                    if (nextStatus === ORDER_STATUS.REVIEW) {
                        return (
                            <button
                                key={nextStatus}
                                onClick={() => setShowRejectModal(true)}
                                disabled={loading}
                                className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <XCircle className="w-5 h-5" />
                                إعادة للمراجعة
                            </button>
                        );
                    }

                    if (nextStatus === ORDER_STATUS.SHOP_READY) {
                        return (
                            <button
                                key={nextStatus}
                                onClick={handleFinishProcessing}
                                disabled={loading}
                                className="w-full py-3 bg-indigo-100 text-indigo-700 rounded-lg font-bold hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2"
                            >
                                <Package className="w-5 h-5" />
                                تم التجهيز (إرسال للمحل)
                            </button>
                        );
                    }

                    if (nextStatus === ORDER_STATUS.COMPLETED) {
                        return (
                            <button
                                key={nextStatus}
                                onClick={() => setShowPaymentModal(true)}
                                disabled={loading}
                                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-5 h-5" />
                                إتمام الطلب والدفع
                            </button>
                        );
                    }

                    return (
                        <button
                            key={nextStatus}
                            onClick={() => handleStatusUpdate(nextStatus)}
                            disabled={loading}
                            className="w-full py-3 bg-zinc-100 text-zinc-700 rounded-lg font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                        >
                            {nextStatus === ORDER_STATUS.DELIVERING ? <Truck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                            {ORDER_STATUS_LABELS[nextStatus as keyof typeof ORDER_STATUS_LABELS]}
                        </button>
                    );
                })}

                {/* Edit for Review State */}
                {order.status === ORDER_STATUS.REVIEW && (
                    <Link
                        href={`/orders/${order.id}/edit`}
                        className="w-full py-3 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                    >
                        تعديل الطلب للمراجعة
                    </Link>
                )}
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">سبب إعادة المراجعة</h3>
                        <textarea
                            className="w-full h-32 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-transparent"
                            placeholder="اكتب تفاصيل المشكلة هنا..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleStatusUpdate(ORDER_STATUS.REVIEW, rejectReason)}
                                disabled={loading || !rejectReason}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50"
                            >
                                إرسال للمراجعة
                            </button>
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">إتمام الطلب والدفع</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="text-zinc-500 hover:text-zinc-700">✕</button>
                        </div>

                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl mb-4 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm">المبلغ المتبقي:</span>
                                <span className="text-xl font-bold text-red-500 font-mono" dir="ltr">{order.remainingAmount.toLocaleString()} د.ل</span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">المبلغ المستلم</label>
                            <input
                                type="number"
                                required
                                step="0.01"
                                className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-transparent"
                                placeholder="0.00"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                            />
                        </div>

                        <textarea
                            className="w-full h-24 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 bg-transparent"
                            placeholder="ملاحظات الدفع (اختياري)..."
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50"
                            >
                                {loading ? 'جاري الإتمام...' : 'تأكيد واستلام'}
                            </button>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold"
                            >
                                رجوع
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
