'use client';

import { Printer, Share2, Download } from 'lucide-react';
import { useState } from 'react';

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
    const [loading, setLoading] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        // فتح نافذة الطباعة مع خيار حفظ كـ PDF
        window.print();
    };

    const handleWhatsApp = () => {
        // إرسال رسالة نصية مع رابط المستند
        const message = `📋 *مستند الطلب #${orderData.serialNumber}*\n\n👤 العميل: ${orderData.customerName}\n📞 الهاتف: ${orderData.customerPhone}\n\n📝 التفاصيل:\n${orderData.description || 'لا توجد تفاصيل'}\n\n💰 المبلغ الإجمالي: ${orderData.totalAmount.toLocaleString()} د.ل\n✅ المدفوع: ${orderData.paidAmount.toLocaleString()} د.ل\n⏳ المتبقي: ${orderData.remainingAmount.toLocaleString()} د.ل\n\n📅 موعد التسليم: ${new Date(orderData.dueDate).toLocaleDateString('ar-LY')}\n\n🔗 رابط المستند:\n${window.location.href}`;

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
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/30 active:scale-95"
            >
                <Download className="w-5 h-5" />
                حفظ PDF
            </button>
            <button
                onClick={handleWhatsApp}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-green-500 transition-all shadow-lg shadow-green-500/30 active:scale-95"
            >
                <Share2 className="w-5 h-5" />
                إرسال واتساب
            </button>
        </div>
    );
}
