'use client';

import { useState } from 'react';
import { updateOrderStatus, completeOrder } from '@/lib/actions/orders';
import { Printer, XCircle, CheckCircle, Truck } from 'lucide-react';
import Link from 'next/link';
import { ORDER_STATUS } from '@/lib/constants';
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
    displayName: string;
    role: string;
    facilityId?: string;
    phoneNumber?: string;
}

export default function OrderActions({ order, currentUser }: { order: Order, currentUser?: User | null }) {
    const [loading, setLoading] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentNote, setPaymentNote] = useState('');

    const handleStatusUpdate = async (newStatus: string, reason?: string) => {
        setLoading(true);
        const res = await updateOrderStatus(order.id, newStatus, reason);
        if (res.success) {
            if (newStatus === ORDER_STATUS.REVIEW_NEEDED) setShowRejectModal(false);
        } else {
            alert(res.error);
        }
        setLoading(false);
    };

    const handleFinishProcessing = async () => {
        setLoading(true);
        const res = await updateOrderStatus(order.id, ORDER_STATUS.TRANSFERRED_TO_SHOP);
        if (res.success) {
            window.open(`/orders/print/${order.id}`, '_blank');
        } else {
            alert(res.error);
        }
        setLoading(false);
    };

    const handleComplete = async () => {
        setLoading(true);
        const res = await completeOrder(order.id, paymentNote);
        if (res.success) {
            setShowPaymentModal(false);
        } else {
            alert(res.error);
        }
        setLoading(false);
    };

    const isFactoryWorker = currentUser?.role === 'ADMIN' || (currentUser?.role !== 'ACCOUNTANT' && currentUser?.facilityId === order.factoryId);
    const isShopWorker = currentUser?.role === 'ADMIN' || (currentUser?.role !== 'ACCOUNTANT' && currentUser?.facilityId === order.shopId);

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

                {/* Factory Actions */}
                {(order.status === ORDER_STATUS.REGISTERED || order.status === ORDER_STATUS.TRANSFERRED_TO_FACTORY) && isFactoryWorker && (
                    <>
                        <button
                            onClick={() => handleStatusUpdate(ORDER_STATUS.PROCESSING)}
                            disabled={loading}
                            className="w-full py-3 bg-primary text-white rounded-lg font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            بدء التجهيز
                        </button>
                        <button
                            onClick={() => setShowRejectModal(true)}
                            disabled={loading}
                            className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <XCircle className="w-5 h-5" />
                            إعادة للمراجعة
                        </button>
                    </>
                )}

                {order.status === ORDER_STATUS.PROCESSING && isFactoryWorker && (
                    <button
                        onClick={handleFinishProcessing}
                        disabled={loading}
                        className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Printer className="w-5 h-5" />
                        تم التجهيز وطباعة الملصق
                    </button>
                )}

                {/* Shop Actions */}
                {order.status === ORDER_STATUS.TRANSFERRED_TO_SHOP && isShopWorker && (
                    <button
                        onClick={() => handleStatusUpdate(ORDER_STATUS.DELIVERING)}
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Truck className="w-5 h-5" />
                        استلام وتسليم للزبون
                    </button>
                )}

                {order.status === ORDER_STATUS.DELIVERING && isShopWorker && (
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        disabled={loading}
                        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle className="w-5 h-5" />
                        إتمام الطلب
                    </button>
                )}

                {/* Review Actions */}
                {order.status === ORDER_STATUS.REVIEW_NEEDED && isShopWorker && (
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
                                onClick={() => handleStatusUpdate(ORDER_STATUS.REVIEW_NEEDED, rejectReason)}
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
                        <h3 className="text-xl font-bold mb-2">إتمام الطلب والدفع</h3>
                        <p className="text-sm text-zinc-500 mb-4">تأكد من استلام كامل المبلغ المتبقي من الزبون قبل الإتمام.</p>

                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl mb-4 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm">المبلغ المتبقي:</span>
                                <span className="text-xl font-bold text-red-500 font-mono" dir="ltr">{order.remainingAmount.toLocaleString()} د.ل</span>
                            </div>
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
                                إتمام واستلام الدفعة
                            </button>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
