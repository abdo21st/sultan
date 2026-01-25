"use client";

import { useState, useEffect } from "react";
import NavBar from "../../components/NavBar";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import {
    TrendingUp, Users, Package, DollarSign,
    Factory as FactoryIcon, Loader2, Calendar
} from "lucide-react";

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6"];

interface StatCardProps {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
}

const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
                <h3 className="text-2xl font-bold font-mono" dir="ltr">{value.toLocaleString()}</h3>
            </div>
            <div className={`p-3 rounded-xl ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    </div>
);

interface AnalyticsData {
    summary: { totalOrders: number; totalRevenue: number; totalCollected: number };
    monthlySales: { month: string; total: number; paid: number }[];
    factoryStats: { name: string; value: number }[];
    statusCounts: Record<string, number>;
}

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/analytics")
            .then(res => res.json())
            .then((data: AnalyticsData) => {
                setData(data);
                setLoading(false);
            })
            .catch((err: unknown) => console.error(err));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <NavBar />
                <div className="flex items-center justify-center h-[80vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            <NavBar />
            <main className="max-w-7xl mx-auto px-4 py-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">التحليلات المتقدمة</h1>
                    <p className="text-muted-foreground mt-2">نظرة شاملة على أداء المبيعات والإنتاج.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="إجمالي الطلبات"
                        value={data?.summary.totalOrders || 0}
                        icon={Package}
                        color="bg-amber-100 text-amber-600"
                    />
                    <StatCard
                        title="إجمالي المبيعات (د.ل)"
                        value={data?.summary.totalRevenue || 0}
                        icon={DollarSign}
                        color="bg-blue-100 text-blue-600"
                    />
                    <StatCard
                        title="إجمالي المحصل (د.ل)"
                        value={data?.summary.totalCollected || 0}
                        icon={TrendingUp}
                        color="bg-green-100 text-green-600"
                    />
                    <StatCard
                        title="الديون المتبقية (د.ل)"
                        value={(data?.summary.totalRevenue || 0) - (data?.summary.totalCollected || 0)}
                        icon={Users}
                        color="bg-red-100 text-red-600"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Sales Trend */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" /> نمو المبيعات (6 أشهر)
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data?.monthlySales || []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Line type="monotone" dataKey="total" name="الإجمالي" stroke="#f59e0b" strokeWidth={3} dot={{ r: 6, fill: '#f59e0b', strokeWidth: 0 }} />
                                    <Line type="monotone" dataKey="paid" name="المحصل" stroke="#10b981" strokeWidth={3} dot={{ r: 6, fill: '#10b981', strokeWidth: 0 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Factory Performance */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <FactoryIcon className="w-5 h-5 text-primary" /> أداء المصانع (حسب القيمة)
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data?.factoryStats || []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="value" name="قيمة الطلبات" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Status Distribution */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <Package className="w-5 h-5 text-primary" /> توزيع حالات الطلبات
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data ? Object.entries(data.statusCounts).map(([name, value]) => ({ name, value })) : []}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {data && Object.entries(data.statusCounts).map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
