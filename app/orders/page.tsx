import { usePermission } from '@/lib/usePermission';
import { PERMISSIONS } from '@/lib/permissions';

// ... inside component ...
const { hasPermission } = usePermission();

// ... JSX ...
<div>
    <h1 className="text-2xl font-bold text-foreground">سجل الطلبات</h1>
    <p className="text-muted-foreground">عرض وإدارة جميع الطلبات المسجلة</p>
</div>
{
    hasPermission(PERMISSIONS.ORDERS_ADD) && (
        <Link
            href="/orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-amber-600 transition-colors"
        >
            <Plus className="w-5 h-5" />
            <span>طلب جديد</span>
        </Link>
    )
}
                </div >

                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <button
                        onClick={() => setActiveTab('ALL')}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'ALL' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                        الكل
                    </button>
                    <button
                        onClick={() => setActiveTab('FACTORY_INBOX')}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'FACTORY_INBOX' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                        المصنع (وارد/تجهيز)
                    </button>
                    <button
                        onClick={() => setActiveTab('SHOP_INBOX')}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'SHOP_INBOX' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                        المحل (مراجعة/تسليم)
                    </button>
                    <button
                        onClick={() => setActiveTab('COMPLETED')}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'COMPLETED' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                        المكتملة
                    </button>
                </div>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <OrderList statusFilter={getFilter(activeTab)} />
                </div>
            </main >
        </div >
    );
}
