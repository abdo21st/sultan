'use client';

import { useState, useEffect } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import NavBar from '../components/NavBar';
import { usePermission } from '../../lib/usePermission';
import { PERMISSIONS } from '../../lib/permissions';

interface Transaction {
    id: string;
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    category: string;
    description?: string;
    date: string;
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
    const [showForm, setShowForm] = useState(false);
    const [stats, setStats] = useState({ totalDebt: 0, treasuryBalance: 0, totalIncome: 0, totalExpense: 0 });

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [unpaidOrders, setUnpaidOrders] = useState<UnpaidOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<string>('');
    const [paymentAmount, setPaymentAmount] = useState<string>('');

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

    async function fetchTransactions() {
        try {
            const res = await fetch('/api/transactions');
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchUnpaidOrders() {
        try {
            const res = await fetch('/api/orders?paymentStatus=unpaid');
            if (res.ok) {
                setUnpaidOrders(await res.json());
            }
        } catch (e) { console.error(e); }
    }

    // Load unpaid orders when modal opens
    useEffect(() => {
        if (showPaymentModal) fetchUnpaidOrders();
    }, [showPaymentModal]);

    async function handlePaymentSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'INCOME',
                    amount: parseFloat(paymentAmount),
                    category: 'SALES', // Or 'DEBT_PAYMENT'
                    orderId: selectedOrder,
                    date: new Date().toISOString().split('T')[0]
                }),
            });

            if (res.ok) {
                setShowPaymentModal(false);
                fetchTransactions();
                fetchStats();
                setPaymentAmount('');
                setSelectedOrder('');
                alert("تم تسجيل الدفعة بنجاح");
            } else {
                const err = await res.json();
                alert(err.error || 'فشل التسجيل');
            }
        } catch {
            alert('فشل الاتصال');
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
        <div className="min-h-screen bg-background pb-20">
            <NavBar />

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                        <p className="text-sm text-muted-foreground mb-1">الخزينة (الكاش)</p>
                        <p className={`text-2xl font-bold font-mono ${stats.treasuryBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stats.treasuryBalance.toLocaleString()} د.ل
                        </p>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                        <p className="text-sm text-muted-foreground mb-1">ديون العملاء</p>
                        <p className="text-2xl font-bold font-mono text-orange-600">
                            {stats.totalDebt.toLocaleString()} د.ل
                        </p>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-xl shadow-sm opacity-75">
                        <p className="text-sm text-muted-foreground mb-1">إجمالي المقبوضات</p>
                        <p className="text-xl font-bold font-mono text-foreground">
                            {stats.totalIncome.toLocaleString()} د.ل
                        </p>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-xl shadow-sm opacity-75">
                        <p className="text-sm text-muted-foreground mb-1">إجمالي المصروفات</p>
                        <p className="text-xl font-bold font-mono text-foreground">
                            {stats.totalExpense.toLocaleString()} د.ل
                        </p>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-foreground">المعاملات المالية</h1>
                    <div className="flex gap-2">
                        {hasPermission(PERMISSIONS.TRANSACTIONS_ADD) && (
                            <>
                                <button
                                    onClick={() => setShowPaymentModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                >
                                    <ArrowUpCircle className="w-5 h-5" />
                                    <span>استلام دفعة طلب</span>
                                </button>
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
                                >
                                    <Plus className="w-5 h-5" />
                                    <span>تسجيل حركة عامة</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Pay Order Modal */}
                {showPaymentModal && (
                    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 animate-in fade-in duration-500">
                        <div className="bg-[#0f172a] w-full max-w-xl rounded-[2.5rem] border border-slate-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] p-12 relative overflow-hidden">
                            {/* Decorative subtle header line */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500/20 to-transparent" />

                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="absolute top-8 left-8 w-10 h-10 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-full text-slate-500 hover:text-white hover:bg-slate-800 transition-all z-10"
                            >✕</button>

                            <div className="mb-10">
                                <h3 className="text-3xl font-black text-white tracking-tight">استلام دفعة لطلب</h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">تسجيل إيراد جديد من مديونية عميل للسلطان.</p>
                            </div>

                            <form onSubmit={handlePaymentSubmit} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        اختر الطلب المعلق
                                    </label>
                                    <select
                                        required
                                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-200 focus:border-amber-500/50 outline-none transition-all duration-300 shadow-inner appearance-none cursor-pointer"
                                        value={selectedOrder}
                                        onChange={e => {
                                            setSelectedOrder(e.target.value);
                                            const order = unpaidOrders.find(o => o.id === e.target.value);
                                            if (order) setPaymentAmount(order.remainingAmount.toString());
                                        }}
                                        aria-label="اختر الطلب"
                                    >
                                        <option value="" className="bg-slate-900">اختر من القائمة...</option>
                                        {unpaidOrders.map(o => (
                                            <option key={o.id} value={o.id} className="bg-slate-900">
                                                طلب رقم #{o.serialNumber} - {o.customerName} (المتبقي: {o.remainingAmount} د.ل)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        المبلغ المورد للخزينة
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            required
                                            step="0.01"
                                            className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-6 text-2xl font-black font-mono text-green-400 focus:border-green-500/30 outline-none transition-all duration-300 placeholder:text-slate-800 shadow-inner"
                                            placeholder="0.00"
                                            value={paymentAmount}
                                            onChange={e => setPaymentAmount(e.target.value)}
                                            aria-label="المبلغ المستلم"
                                        />
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 font-bold text-xs">دينار ليبي</span>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button
                                        type="submit"
                                        className="flex-[2] py-5 bg-gradient-to-br from-green-600 to-green-900 text-white rounded-[1.5rem] font-black text-[12px] uppercase tracking-widest shadow-xl shadow-green-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
                                    >
                                        تأكيد تحصيل الدفعة
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowPaymentModal(false)}
                                        className="flex-1 py-5 bg-slate-900 text-slate-400 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest border border-slate-800 hover:bg-slate-800 hover:text-white transition-all"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Add Transaction Form */}
                {showForm && (
                    <div className="mb-8 bg-card border border-border rounded-xl p-6 shadow-sm animate-in slide-in-from-top-4 fade-in duration-300">
                        <h3 className="text-lg font-semibold mb-4 text-foreground">تسجيل حركة جديدة (عامة)</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">النوع</label>
                                    <div className="flex gap-2">
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
                                    className="px-6 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-600 rounded-lg shadow-sm"
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
                            <div key={tx.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow">
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
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold font-mono ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                                        {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString()} د.ل
                                    </p>
                                    <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
