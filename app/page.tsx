import Link from "next/link";
import OrderList from "./components/OrderList";
import {
  Banknote,
  ClipboardList,
  Clock,
  PlusCircle,
  Search,
  TrendingUp
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen pb-20">
      {/* Top Navigation Bar */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
              سلطان
            </h1>
            <div className="flex gap-4">
              <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

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
                <h3 className="text-3xl font-bold text-foreground mt-1">0.00 <span className="text-sm font-normal text-muted-foreground">ر.س</span></h3>
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
                <h3 className="text-3xl font-bold text-foreground mt-1">0</h3>
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
                <h3 className="text-3xl font-bold text-foreground mt-1">0.00 <span className="text-sm font-normal text-muted-foreground">ر.س</span></h3>
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

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/orders/new" className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer">
            <div className="p-3 bg-primary/10 rounded-full text-primary mb-3 group-hover:scale-110 transition-transform">
              <PlusCircle className="w-6 h-6" />
            </div>
            <span className="font-medium text-foreground">طلب جديد</span>
          </Link>

          <Link href="/facilities/new" className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer">
            <div className="p-3 bg-primary/10 rounded-full text-primary mb-3 group-hover:scale-110 transition-transform">
              <PlusCircle className="w-6 h-6" />
            </div>
            <span className="font-medium text-foreground">إضافة منشأة</span>
          </Link>

          {/* Placeholder for future features */}
          <div className="flex flex-col items-center justify-center p-6 bg-card border border-border border-dashed rounded-xl opacity-50 cursor-not-allowed">
            <span className="font-medium text-muted-foreground">تسجيل معاملة (قريباً)</span>
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
