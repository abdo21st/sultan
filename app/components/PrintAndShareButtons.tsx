'use client';

import { Printer, Share2 } from 'lucide-react';

interface PrintAndShareButtonsProps {
    orderData: {
        serialNumber: number;
        customerName: string;
        customerPhone: string;
        description: string | null;
        totalAmount: number;
        paidAmount: number;
        remainingAmount: number;
        dueDate: Date;
        orderId: string;
    };
}

export default function PrintAndShareButtons({ orderData }: PrintAndShareButtonsProps) {
    const handlePrint = () => {
        window.print();
    };

    const handleWhatsApp = () => {
        const message = `
🔔 *طلب جديد - #${orderData.serialNumber}*

👤 العميل: ${orderData.customerName}
📞 الهاتف: ${orderData.customerPhone}

📝 التفاصيل:
${orderData.description || 'لا توجد تفاصيل'}

💰 المبلغ الإجمالي: ${orderData.totalAmount.toLocaleString()} د.ل
✅ المدفوع: ${orderData.paidAmount.toLocaleString()} د.ل
⏳ المتبقي: ${orderData.remainingAmount.toLocaleString()} د.ل

📅 موعد التسليم: ${new Date(orderData.dueDate).toLocaleDateString('ar-LY')}

🔗 رابط الطلب: ${window.location.origin}/orders/print/${orderData.orderId}
        `.trim();

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 no-print z-50">
            <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-6 py-3 bg-amber-700 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/30 active:scale-95"
            >
                <Printer className="w-5 h-5" />
                طباعة
            </button>
            <button
                onClick={handleWhatsApp}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-green-500 transition-all shadow-lg shadow-green-500/30 active:scale-95"
            >
                <Share2 className="w-5 h-5" />
                إرسال واتساب
            </button>
        </div>
    );
}
