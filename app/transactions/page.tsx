'use client';

import { useState, useEffect, useRef } from 'react';
import Modal from '../components/Modal';
import { Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { usePermission } from '../../lib/usePermission';
import { PERMISSIONS } from '../../lib/permissions';
import { formatCurrency } from '../../lib/utils';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import ReverseTransaction from './ReverseTransaction';
import Link from 'next/link';

interface Transaction {
    id: string;
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    category: string;
    description?: string;
    date: string;
    orderId?: string | null;
    adjustmentId?: string | null;
    adjustment?: { orderId: string; kind: string } | null;
    reversalOfId?: string | null;
    reversalReason?: string | null;
    reversedBy?: { id: string } | null;
}

interface UnpaidOrder {
    id: string;
    serialNumber: number;
    customerName: string;
    remainingAmount: number;
}

export default function TransactionsPage() {
    const { hasPermission } = usePermission();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [nextTransactionsCursor, setNextTransactionsCursor] = useState<string | null>(null);
    const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [stats, setStats] = useState({ totalDebt: 0, treasuryBalance: 0, totalIncome: 0, totalExpense: 0, pendingRefunds: 0 });

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [unpaidOrders, setUnpaidOrders] = useState<UnpaidOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<string>('');
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const paymentSubmissionLock = useRef(false);

    const [formData, setFormData] = useState({
        type: 'EXPENSE',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchTransactions();
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const res = await fetch('/api/finance/stats');
            if (res.ok) setStats(await res.json());
        } catch (e) {
            console.error(e);
        }
    }

    async function fetchTransactions(cursor?: string | null) {
        try {
            if (cursor) setLoadingMoreTransactions(true);
            else setLoading(true);
            const params = new URLSearchParams({ limit: '50' });
            if (cursor) params.set('cursor', cursor);
            const res = await fetch(`/api/transactions?${params}`);
            if (res.ok) {
                const data = await res.json();
                setTransactions((previous) => cursor ? [...previous, ...data] : data);
                setNextTransactionsCursor(res.headers.get('X-Next-Cursor'));
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (cursor) setLoadingMoreTransactions(false);
            else setLoading(false);
        }
    }

    async function fetchUnpaidOrders() {
        try {
            const orders = await fetchAllPages<UnpaidOrder>('/api/orders?paymentStatus=unpaid');
            setUnpaidOrders(orders);
        } catch (e) { console.error(e); }
    }

    // Load unpaid orders when modal opens
    useEffect(() => {
        if (showPaymentModal) fetchUnpaidOrders();
    }, [showPaymentModal]);

    async function handlePaymentSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (paymentSubmissionLock.current) return;
        paymentSubmissionLock.current = true;
        setIsSubmittingPayment(true);
        const idempotencyKey = paymentIdempotencyKey || crypto.randomUUID();
        setPaymentIdempotencyKey(idempotencyKey);
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'INCOME',
                    amount: parseFloat(paymentAmount),
                    category: 'SALES', // Or 'DEBT_PAYMENT'
                    orderId: selectedOrder,
                    idempotencyKey,
                    date: new Date().toISOString().split('T')[0]
                }),
            });

            if (res.ok) {
                setShowPaymentModal(false);
                fetchTransactions();
                fetchStats();
                setPaymentAmount('');
                setSelectedOrder('');
                setPaymentIdempotencyKey('');
                alert("تم تسجيل الدفعة بنجاح");
            } else {
                const err = await res.json();
                alert(err.error || 'فشل التسجيل');
            }
        } catch {
            alert('فشل الاتصال');
        } finally {
            paymentSubmissionLock.current = false;
            setIsSubmittingPayment(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setShowForm(false);
                fetchTransactions();
                fetchStats();
                setFormData({ ...formData, amount: '', description: '' });
            }
        } catch {
            alert('فشل حفظ المعاملة');
        }
    }

    return (
        <div className="min-h-full bg-background pb-20">

            <main className="ui-page">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
                    <div className="ui-card"><p className="text-sm text-muted-foreground mb-1">مبالغ معتمدة متبقية للرد</p><p className="text-2xl font-bold text-rose-700">{formatCurrency(stats.pendingRefunds || 0)}</p><Link href="/adjustments" className="text-sm text-primary underline">فتح التسويات</Link></div>
                    <div className="bg-card border border-border p-4 rounded-xl ">
                        <p className="text-sm text-muted-foreground mb-1">الخزينة (الكاش)</p>
                        <p className={`text-2xl font-bold font-mono ${stats.treasuryBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(stats.treasuryBalance)}
                        </p>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-xl ">
                        <p className="text-sm text-muted-foreground mb-1">ديون العملاء</p>
                        <p className="text-2xl font-bold font-mono text-orange-600">
                            {formatCurrency(stats.totalDebt)}
                        </p>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-xl  opacity-75">
                        <p className="text-sm text-muted-foreground mb-1">صافي المقبوضات</p>
                        <p className="text-xl font-bold font-mono text-foreground">
                            {formatCurrency(stats.totalIncome)}
                        </p>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-xl  opacity-75">
                        <p className="text-sm text-muted-foreground mb-1">صافي المصروفات</p>
                        <p className="text-xl font-bold font-mono text-foreground">
                            {formatCurrency(stats.totalExpense)}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                    <h1 className="text-2xl font-bold text-foreground">التحصيل والحركات المالية</h1>
                    <div className="flex flex-wrap gap-2">
                        {hasPermission(PERMISSIONS.TRANSACTIONS_ADD) && (
                            <>
                                <button
                                    onClick={() => setShowPaymentModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors "
                                >
                                    <ArrowUpCircle className="w-5 h-5" />
                                    <span>استلام دفعة طلب</span>
                                </button>
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="flex items-center gap-2 px-4 py-2 bg-card text-foreground border border-border rounded-lg hover:bg-muted transition-colors "
                                >
                                    <Plus className="w-5 h-5" />
                                    <span>تسجيل حركة عامة</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="استلام دفعة طلب">
<form onSubmit={handlePaymentSubmit} className="space-y-5">
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase  flex items-center gap-2 px-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        الطلب المراد تحصيله
                                    </label>
                                    <select
                                        required
                                        className="w-full bg-card border-2 border-border rounded-xl p-4 text-sm font-bold text-foreground focus:border-amber-500/50 outline-none transition-all duration-300  appearance-none cursor-pointer"
                                        value={selectedOrder}
                                        onChange={e => {
                                            setSelectedOrder(e.target.value);
                                            setPaymentIdempotencyKey('');
                                            const order = unpaidOrders.find(o => o.id === e.target.value);
                                            if (order) setPaymentAmount(order.remainingAmount.toString());
                                        }}
                                        aria-label="اختر الطلب"
                                    >
                                        <option value="" className="bg-muted">اختر من القائمة...</option>
                                        {unpaidOrders.map(o => (
                                            <option key={o.id} value={o.id} className="bg-muted">
                                                طلب رقم #{o.serialNumber} - {o.customerName} (المتبقي: {o.remainingAmount} د.ل)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase  flex items-center gap-2 px-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        المبلغ المستلم
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            required
                                            step="0.01"
                                            className="w-full bg-card border-2 border-border rounded-xl p-3 text-lg font-semibold font-mono text-foreground focus:border-green-500/30 outline-none transition-all duration-300 placeholder:text-muted-foreground "
                                            placeholder="0.00"
                                            value={paymentAmount}
                                            onChange={e => {
                                                setPaymentAmount(e.target.value);
                                                setPaymentIdempotencyKey('');
                                            }}
                                            aria-label="المبلغ المستلم"
                                        />
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">دينار ليبي</span>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmittingPayment}
                                        className="flex-[2] py-3 bg-primary text-white rounded-xl font-semibold text-[12px] uppercase      transition-all duration-300 disabled:opacity-50"
                                    >
                                        {isSubmittingPayment ? 'جارٍ تسجيل الدفعة...' : 'تأكيد تحصيل الدفعة'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowPaymentModal(false)}
                                        className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-semibold text-xs uppercase  border border-border hover:bg-muted hover:text-foreground transition-all"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </form>
                </Modal>

                {/* Add Transaction Form */}
                {showForm && (
                    <div className="mb-8 bg-card border border-border rounded-xl p-6  animate-in slide-in-from-top-4 fade-in duration-300">
                        <h3 className="text-lg font-semibold mb-4 text-foreground">تسجيل حركة جديدة (عامة)</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">النوع</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                                            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${formData.type === 'INCOME' ? 'bg-green-500 text-white border-green-600' : 'border-input text-muted-foreground hover:bg-muted'}`}
                                        >
                                            إيراد (+)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                                            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${formData.type === 'EXPENSE' ? 'bg-red-500 text-white border-red-600' : 'border-input text-muted-foreground hover:bg-muted'}`}
                                        >
                                            مصروف (-)
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">المبلغ</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        dir="ltr"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">التصنيف</label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                                        required
                                        aria-label="تصنيف الحركة المالية"
                                    >
                                        <option value="" disabled>اختر تصنيفاً</option>
                                        <option value="SALES">مبيعات</option>
                                        <option value="SALARY">رواتب</option>
                                        <option value="RENT">إيجار</option>
                                        <option value="RAW_MATERIALS">مواد خام</option>
                                        <option value="UTILITIES">فواتير وخدمات</option>
                                        <option value="OTHER">أخرى</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">التاريخ</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                                        aria-label="تاريخ الحركة"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">الوصف</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                                    placeholder="تفاصيل إضافية..."
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg "
                                >
                                    حفظ
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Transactions List */}
                <div className="space-y-4">
                    {loading ? (
                        <p className="text-center text-muted-foreground">جاري التحميل...</p>
                    ) : transactions.length === 0 ? (
                        <div className="text-center p-8 border border-dashed border-border rounded-xl">
                            <p className="text-muted-foreground">لا توجد معاملات مسجلة بعد.</p>
                        </div>
                    ) : (
                        transactions.map((tx) => (
                            <div key={tx.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between  transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'INCOME' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                                        }`}>
                                        {tx.type === 'INCOME' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-foreground">
                                            {tx.category === 'SALES' ? 'مبيعات' :
                                                tx.category === 'SALARY' ? 'رواتب' :
                                                    tx.category === 'RENT' ? 'إيجار' :
                                                        tx.category === 'RAW_MATERIALS' ? 'مواد خام' :
                                                            tx.category === 'UTILITIES' ? 'فواتير وخدمات' :
                                                                tx.category === 'OTHER' ? 'أخرى' :
                                                                    tx.category}
                                        </h4>
                                        <p className="text-xs text-muted-foreground">{tx.description || '-'}</p>
                                        {tx.reversalOfId && <p className="text-xs font-bold text-primary">قيد عكسي — {tx.reversalReason}</p>}
                                        {tx.reversedBy && <p className="text-xs font-bold text-muted-foreground">عُكست هذه الحركة مع حفظ الأصل</p>}
                                        {tx.amount > 0 && !tx.reversedBy && hasPermission(PERMISSIONS.TRANSACTIONS_REVERSE) && <ReverseTransaction transaction={tx} onSuccess={() => { void fetchTransactions(); void fetchStats(); }} />}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold font-mono ${(tx.type === 'INCOME' ? tx.amount : -tx.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                                        {(tx.type === 'INCOME' ? tx.amount : -tx.amount) > 0 ? '+' : ''}{formatCurrency(tx.type === 'INCOME' ? tx.amount : -tx.amount)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {nextTransactionsCursor && (
                    <div className="flex justify-center mt-8">
                        <button
                            type="button"
                            disabled={loadingMoreTransactions}
                            onClick={() => fetchTransactions(nextTransactionsCursor)}
                            className="px-6 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
                        >
                            {loadingMoreTransactions ? 'جاري التحميل...' : 'تحميل معاملات أقدم'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
