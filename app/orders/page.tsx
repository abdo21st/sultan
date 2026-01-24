'use client';

import NavBar from '../components/NavBar';
import OrderList from '../components/OrderList';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function OrdersPage() {
    return (
        <div className="min-h-screen bg-background">
            <NavBar />

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">سجل الطلبات</h1>
                        <p className="text-muted-foreground">عرض وإدارة جميع الطلبات المسجلة</p>
                    </div>
                    <Link
                        href="/orders/new"
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-amber-600 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span>طلب جديد</span>
                    </Link>
                </div>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <OrderList />
                </div>
            </main>
        </div>
    );
}
