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
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-card w-full max-w-lg rounded-xl shadow-xl p-6 relative">
                            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 left-4 text-muted-foreground hover:text-foreground">✕</button>
                            <h3 className="text-lg font-bold mb-4">استلام دفعة لطلب</h3>
                            <form onSubmit={handlePaymentSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">اختر الطلب</label>
                                    <select
                                        required
                                        className="w-full p-2 border rounded-lg bg-background"
                                        value={selectedOrder}
                                        onChange={e => {
                                            setSelectedOrder(e.target.value);
                                            const order = unpaidOrders.find(o => o.id === e.target.value);
                                            if (order) setPaymentAmount(order.remainingAmount.toString());
                                        }}
                                        aria-label="اختر الطلب"
                                    >
                                        <option value="">اختر الطلب...</option>
                                        {unpaidOrders.map(o => (
                                            <option key={o.id} value={o.id}>
                                                #{o.serialNumber} - {o.customerName} (باقي: {o.remainingAmount})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">المبلغ المستلم</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        className="w-full p-2 border rounded-lg bg-background"
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(e.target.value)}
                                        aria-label="المبلغ المستلم"
                                    />
                                </div>
                                <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">
                                    تأكيد الاستلام
                                </button>
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
