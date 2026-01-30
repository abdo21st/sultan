'use client';

import { useState } from 'react';
import { updateOrderStatus, completeOrder } from '@/lib/actions/orders';
import { Printer, XCircle, CheckCircle, Truck, Package, RefreshCw } from 'lucide-react';
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
        <div className="bg-zinc-900/40 backdrop-blur-md rounded-2xl p-8 border border-white/5 shadow-2xl glass">
            <h3 className="text-[10px] font-black text-gradient-gold uppercase tracking-[0.2em] mb-6 border-b border-white/5 pb-4">الإجراءات والعمليات</h3>

            <div className="flex flex-col gap-4">
                <Link
                    href={`/orders/print/${order.id}`}
                    target="_blank"
                    className="w-full py-4 bg-white/5 text-foreground rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all duration-300 border border-white/5 flex items-center justify-center gap-3 active:scale-95"
                >
                    <Printer className="w-4 h-4 text-primary" />
                    طباعة المستند الرسمي
                </Link>

                {/* Dynamic Sequential Actions */}
                {ORDER_WORKFLOW[order.status as keyof typeof ORDER_WORKFLOW]?.map((nextStatus: string) => {
                    const hasPermission = currentUser?.role === 'ADMIN' || currentUser?.permissions?.includes(nextStatus);

                    if (!hasPermission) return null;

                    if (nextStatus === ORDER_STATUS.PROCESSING) {
                        return (
                            <button
                                key={nextStatus}
                                onClick={() => handleStatusUpdate(nextStatus)}
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-br from-primary to-amber-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all duration-500 flex items-center justify-center gap-3 active:scale-95 gold-glow"
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
                                className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-500/20 transition-all duration-300 flex items-center justify-center gap-3 active:scale-95"
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
                                className="w-full py-4 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-500/20 transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-indigo-500/5"
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
                                className="w-full py-4 bg-green-500 text-black rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-green-400 transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
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
                            className="w-full py-4 bg-white/5 text-foreground rounded-2xl font-black text-[11px] uppercase tracking-widest border border-white/5 hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-3"
                        >
                            {nextStatus === ORDER_STATUS.DELIVERING ? <Truck className="w-5 h-5 text-primary" /> : <Package className="w-5 h-5 text-primary" />}
                            {ORDER_STATUS_LABELS[nextStatus as keyof typeof ORDER_STATUS_LABELS]}
                        </button>
                    );
                })}

                {/* Edit for Review State */}
                {order.status === ORDER_STATUS.REVIEW && (
                    <Link
                        href={`/orders/${order.id}/edit`}
                        className="w-full py-4 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-amber-500/20 transition-all duration-300 flex items-center justify-center gap-3"
                    >
                        تعديل للمراجعة
                    </Link>
                )}
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/5 rounded-[2rem] p-10 w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] glass">
                        <h3 className="text-2xl font-black text-gradient-gold tracking-tight mb-2">إعادة للمراجعة</h3>
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-8">يرجى توضيح سبب الرفض أو الملاحظات الفنية.</p>
                        <textarea
                            className="w-full h-40 p-6 bg-white/5 border border-white/10 rounded-3xl text-sm font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 mb-8 resize-none"
                            placeholder="اكتب التفاصيل هنا..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleStatusUpdate(ORDER_STATUS.REVIEW, rejectReason)}
                                disabled={loading || !rejectReason}
                                className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-red-500/20 disabled:opacity-50"
                            >
                                تأكيد الإعادة
                            </button>
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 py-4 bg-white/5 text-muted-foreground rounded-2xl font-black text-[11px] uppercase tracking-widest border border-white/5 hover:text-foreground transition-colors"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/5 rounded-[2rem] p-10 w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] glass">
                        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
                            <div>
                                <h3 className="text-2xl font-black text-gradient-gold tracking-tight">إتمام التحصيل</h3>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">تأكيد استلام المبلغ المتبقي.</p>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} className="p-3 hover:bg-white/5 rounded-full text-zinc-500 hover:text-primary transition-colors">✕</button>
                        </div>

                        <div className="bg-white/5 p-8 rounded-3xl mb-8 border border-white/5 glass">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">المبلغ المتبقي المعلق</span>
                                <span className="text-3xl font-black text-red-500 font-mono tracking-tighter" dir="ltr">{order.remainingAmount.toLocaleString()} د.ل</span>
                            </div>
                        </div>

                        <div className="mb-8 space-y-3">
                            <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2 px-1">
                                المبلغ المقبوض فعلياً
                            </label>
                            <input
                                type="number"
                                required
                                step="0.01"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-black font-mono text-green-500 focus:border-green-500/50 focus:ring-4 focus:ring-green-500/5 outline-none transition-all duration-300"
                                placeholder="0.00"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                            />
                        </div>

                        <div className="mb-10 space-y-3">
                            <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2 px-1">
                                ملاحظات التحصيل
                            </label>
                            <textarea
                                className="w-full h-24 p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 resize-none"
                                placeholder="أي ملاحظات إضافية..."
                                value={paymentNote}
                                onChange={(e) => setPaymentNote(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="flex-[2] py-4 bg-green-500 text-black rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-green-500/20 disabled:opacity-50 active:scale-95"
                            >
                                {loading ? 'جاري المعالجة...' : 'تأكيد التسليم الرسمي'}
                            </button>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 py-4 bg-white/5 text-muted-foreground rounded-2xl font-black text-[11px] uppercase tracking-widest border border-white/5"
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
