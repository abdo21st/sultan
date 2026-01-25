'use client';

import { useState } from 'react';
import { updateOrderStatus, completeOrder } from '../actions';
import { Printer, XCircle, CheckCircle, Truck } from 'lucide-react';
import Link from 'next/link';

interface Order {
    id: string;
    serialNumber: string;
    customerName: string;
    customerPhone: string;
    description?: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    factoryId?: string;
    shopId?: string;
    rejectionReason?: string;
}

interface User {
    id: string;
    displayName: string;
    role: string;
    facilityId?: string;
    phoneNumber?: string;
}

export default function OrderActions({ order, currentUser }: { order: Order, currentUser: User }) {
    const [loading, setLoading] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentNote, setPaymentNote] = useState('');
    const [showShareModal, setShowShareModal] = useState(false);
    const [employees, setEmployees] = useState<User[]>([]);

    // Fetch employees when modal opens
    // We use a simplified approach: fetch all and filter client side if needed, or if we had an API for facility employees
    const fetchEmployees = async () => {
        if (employees.length > 0) return;
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                // Filter users who have phone numbers
                setEmployees(data.filter((u: User) => u.phoneNumber));
            }
        } catch (error: unknown) {
            console.error(error);
        }
    };

    if (showShareModal && employees.length === 0) {
        fetchEmployees();
    }

    const isFactoryWorker = currentUser?.role === 'ADMIN' || (currentUser?.facilityId === order.factoryId);
    const isShopWorker = currentUser?.role === 'ADMIN' || (currentUser?.facilityId === order.shopId);

    const handleStatusUpdate = async (status: string) => {
        if (!confirm('هل أنت متأكد من تغيير حالة الطلب؟')) return;
        setLoading(true);
        await updateOrderStatus(order.id, status);
        setLoading(false);
    };

    const handleReject = async () => {
        if (!rejectReason) return alert('يرجى كتابة سبب المراجعة');
        setLoading(true);
        await updateOrderStatus(order.id, 'REVIEW_NEEDED', rejectReason);
        setShowRejectModal(false);
        setLoading(false);
    };

    const handleFinishProcessing = async () => {
        if (!confirm('هل أنت متأكد من إتمام التجهيز؟ سيتم طباعة الملصق.')) return;
        setLoading(true);
        await updateOrderStatus(order.id, 'TRANSFERRED_TO_SHOP');
        // Open Print Label
        window.open(`/orders/${order.id}/label`, '_blank');
        setLoading(false);
    };

    const handleComplete = async () => {
        if (order.remainingAmount > 0 && !paymentNote) {
            alert('يوجد مبلغ متبقي. يرجى إدخال ملاحظة عدم الدفع أو تسجيل الدفع أولاً.');
            return;
        }
        setLoading(true);
        await completeOrder(order.id, paymentNote);
        setShowPaymentModal(false);
        setLoading(false);
    };

    if (order.status === 'COMPLETED') return null;

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
                {(order.status === 'REGISTERED' || order.status === 'TRANSFERRED_TO_FACTORY') && isFactoryWorker && (
                    <>
                        <button
                            onClick={() => handleStatusUpdate('PROCESSING')}
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

                {order.status === 'PROCESSING' && isFactoryWorker && (
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
                {order.status === 'TRANSFERRED_TO_SHOP' && isShopWorker && (
                    <button
                        onClick={() => handleStatusUpdate('DELIVERING')}
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Truck className="w-5 h-5" />
                        استلام وتسليم للزبون
                    </button>
                )}

                {order.status === 'DELIVERING' && isShopWorker && (
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
                {order.status === 'REVIEW_NEEDED' && isShopWorker && (
                    <Link
                        href={`/orders/${order.id}/edit`}
                        className="w-full py-3 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <EditIcon className="w-5 h-5" />
                        تعديل وإعادة إرسال
                    </Link>
                )}
                {order.status === 'REVIEW_NEEDED' && order.rejectionReason && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-red-700 text-sm">
                        <b>سبب المراجعة:</b> {order.rejectionReason}
                    </div>
                )}


                {/* Modals */}
                {showRejectModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl p-6 space-y-4">
                            <h3 className="font-bold text-lg">سبب المراجعة</h3>
                            <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                className="w-full p-3 border rounded-lg"
                                rows={3}
                                placeholder="اكتب السبب..."
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-muted-foreground">إلغاء</button>
                                <button onClick={handleReject} className="px-4 py-2 bg-red-600 text-white rounded-lg">تأكيد</button>
                            </div>
                        </div>
                    </div>
                )}

                {showPaymentModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl p-6 space-y-4">
                            <h3 className="font-bold text-lg">تأكيد الإتمام</h3>
                            {order.remainingAmount > 0 ? (
                                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-2">
                                    تنبيه: يوجد مبلغ متبقي <b>{order.remainingAmount} د.ل</b>
                                </div>
                            ) : (
                                <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm mb-2">
                                    الطلب خالص مادياً.
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium">ملاحظات (سبب عدم الدفع / تفاصيل)</label>
                                <input
                                    type="text"
                                    value={paymentNote}
                                    onChange={e => setPaymentNote(e.target.value)}
                                    className="w-full p-2 border rounded-lg mt-1"
                                    placeholder={order.remainingAmount > 0 ? "يجب كتابة سبب عدم الاستلام..." : "اختياري..."}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-muted-foreground">إلغاء</button>
                                <button onClick={handleComplete} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">إتمام نهائي</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* WhatsApp Consumer Link */}
            <a
                href={`https://wa.me/${order.customerPhone}?text=مرحباً ${order.customerName}، بخصوص طلبك رقم ${order.serialNumber}: حالة الطلب ${order.status}`}
                target="_blank"
                rel="noreferrer"
                className="w-full mt-3 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
                <div className="w-5 h-5 flex items-center justify-center rounded-full border border-white">W</div>
                تواصل مع الزبون
            </a>

            {/* Share with Employee Button */}
            <button
                onClick={() => setShowShareModal(true)}
                className="w-full mt-2 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
                <div className="w-5 h-5 flex items-center justify-center rounded-full border border-white">E</div>
                إرسال للموظف
            </button>

            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl p-6 space-y-4">
                        <h3 className="font-bold text-lg">إرسال تفاصيل الطلب لموظف</h3>
                        <p className="text-sm text-muted-foreground">اختر الموظف لإرسال التفاصيل له عبر واتساب</p>

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {employees.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-4">جاري تحميل الموظفين...</p>
                            ) : (
                                employees.map((emp: User) => (
                                    <a
                                        key={emp.id}
                                        href={`https://wa.me/${emp.phoneNumber}?text=طلب جديد رقم ${order.serialNumber}%0Aالعميل: ${order.customerName}%0Aالوصف: ${order.description}`}
                                        target="_blank"
                                        onClick={() => setShowShareModal(false)}
                                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {emp.displayName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium">{emp.displayName}</p>
                                                <p className="text-xs text-muted-foreground">{emp.role}</p>
                                            </div>
                                        </div>
                                        {emp.phoneNumber ? (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">whatsapp</span>
                                        ) : (
                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">لا يوجد رقم</span>
                                        )}
                                    </a>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button onClick={() => setShowShareModal(false)} className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function EditIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
    )
}
