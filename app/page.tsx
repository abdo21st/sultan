"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OrderList from "./components/OrderList";
import {
  Banknote,
  ClipboardList,
  PlusCircle,
  TrendingUp
} from "lucide-react";
import NavBar from "./components/NavBar";

export default function Home() {
  const [stats, setStats] = useState({
    totalSales: 0,
    activeOrdersCount: 0,
    totalDebts: 0
  });

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setStats(data);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen pb-20">
      {/* Top Navigation Bar */}
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Welcome Section */}
        <header>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">لوحة التحكم</h2>
          <p className="text-muted-foreground mt-2">نظرة عامة على أداء مشروعك اليوم.</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Sales */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">إجمالي المبيعات (شهري)</p>
                <h3 className="text-3xl font-bold text-foreground mt-1" dir="ltr">
                  {stats.totalSales.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">د.ل</span>
                </h3>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <div className="text-xs text-green-600 flex items-center gap-1">
              <span className="font-bold">+0%</span>
              <span>مقارنة بالشهر الماضي</span>
            </div>
          </div>

          {/* Card 2: Active Orders */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">الطلبات النشطة</p>
                <h3 className="text-3xl font-bold text-foreground mt-1" dir="ltr">{stats.activeOrdersCount}</h3>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                <ClipboardList className="w-6 h-6" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              طلبات قيد التنفيذ حالياً
            </div>
          </div>

          {/* Card 3: Due Amount */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">الديون المستحقة</p>
                <h3 className="text-3xl font-bold text-foreground mt-1" dir="ltr">
                  {stats.totalDebts.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">د.ل</span>
                </h3>
              </div>
              <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                <Banknote className="w-6 h-6" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              مبالغ متبقية على العملاء
            </div>
          </div>
        </div>

        {/* Quick Actions & Mobile Apps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-foreground">الوصول السريع</h3>
            <div className="flex gap-4">
              <Link href="/orders/new" className="flex flex-col items-center justify-center p-8 bg-card border border-border rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer w-full md:w-auto min-w-[200px] glass">
                <div className="p-4 bg-primary/10 rounded-full text-primary mb-4 group-hover:scale-110 transition-transform">
                  <PlusCircle className="w-8 h-8" />
                </div>
                <span className="font-black text-xs uppercase tracking-widest text-foreground">إنشاء طلب جديد</span>
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
              <span className="p-2 bg-amber-500/10 rounded-lg"><TrendingUp className="w-5 h-5 text-amber-500" /></span>
              حلول الهاتف المتحرك
            </h3>
            <div className="bg-gradient-to-br from-zinc-900 to-[#0c0a09] border border-white/5 rounded-3xl p-8 relative overflow-hidden glass group">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-700" />
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="flex-1 space-y-4 text-center md:text-right">
                  <h4 className="text-xl font-black text-gradient-gold">تطبيق سلطان للأندرويد</h4>
                  <p className="text-xs text-muted-foreground/60 font-bold leading-relaxed">
                    احصل على تجربة إدارية كاملة من هاتفك مباشرة. تتبع الطلبات، الإشعارات الفورية، وتحكم كامل في أي وقت.
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start pt-2">
                    <a
                      href="/downloads/sultan-v1.apk"
                      className="px-6 py-3 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all duration-300 flex items-center gap-3 active:scale-95 shadow-xl shadow-white/5"
                    >
                      <PlusCircle className="w-4 h-4 rotate-45" />
                      تحميل ملف APK
                    </a>
                    <button
                      onClick={() => alert('لتثبيت التطبيق: افتح الموقع من كروم الهاتف، واضغط على "إضافة إلى الشاشة الرئيسية"')}
                      className="px-6 py-3 bg-white/5 text-foreground border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all duration-300 flex items-center gap-3 active:scale-95"
                    >
                      دليل التثبيت (PWA)
                    </button>
                  </div>
                </div>
                <div className="hidden lg:block w-32 h-32 bg-white/5 rounded-3xl border border-white/5 p-4 transform rotate-6 group-hover:rotate-0 transition-transform duration-700">
                  <div className="w-full h-full bg-gradient-to-br from-primary to-amber-700 rounded-xl flex items-center justify-center text-white gold-glow">
                    <PlusCircle className="w-12 h-12" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-foreground">آخر الطلبات</h3>
            <Link href="/orders" className="text-sm text-primary hover:underline">عرض الكل</Link>
          </div>
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <OrderList />
          </div>
        </section>

      </main>
    </div>
  );
}
