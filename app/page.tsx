import Link from "next/link";
import OrderList from "./components/OrderList";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
            طلبات السلطان
          </h1>
          <div className="flex gap-4">
            <Link href="/facilities/new" className="text-sm font-medium hover:text-amber-600 transition-colors">
              إضافة منشأة
            </Link>
            <Link href="/orders/new" className="text-sm font-medium hover:text-amber-600 transition-colors">
              طلب جديد
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">لوحة التحكم</h2>
          <p className="text-zinc-500 mt-2">إدارة الطلبات والمنشآت الخاصة بك.</p>
        </header>

        <OrderList />
      </main>
    </div>
  );
}
