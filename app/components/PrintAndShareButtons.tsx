'use client';

import { Printer, Share2, Download } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

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
        shareUrl: string;
        appName: string;
        printHeader: string;
        printFooter: string;
        printTerms: string;
        factoryName: string;
        shopName: string;
        qrDataUrl: string;
        closed: boolean;
        statusLabel: string;
        refundRemaining: number;
        correctionReason: string;
    };
    canViewFinancials?: boolean;
}

export default function PrintAndShareButtons({ orderData, canViewFinancials }: PrintAndShareButtonsProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        setLoading(true);
        setError('');
        try {
            const { exportToPDF } = await import('@/lib/pdf-export');
            exportToPDF({
                title: `${orderData.appName} · طلب #${orderData.serialNumber}`,
                subtitle: 'مستند الطلب · امسح الرمز لفتح النسخة الرقمية',
                columns: [{ header: 'التفاصيل', dataKey: 'value' }, { header: 'البيان', dataKey: 'label' }],
                rows: [
                    { label: 'المنشأة', value: orderData.printHeader || orderData.appName },
                    { label: 'العميل', value: orderData.customerName },
                    { label: 'الهاتف', value: orderData.customerPhone },
                    { label: 'المحل', value: orderData.shopName },
                    { label: 'المصنع', value: orderData.factoryName },
                    { label: 'الحالة', value: orderData.statusLabel },
                    ...(orderData.correctionReason ? [{ label: 'يحتاج تصحيحاً', value: orderData.correctionReason }] : []),
                    { label: 'موعد التسليم', value: new Date(orderData.dueDate).toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' }) },
                    { label: 'تفاصيل الطلب', value: orderData.description || '' },
                    ...(canViewFinancials ? [
                        { label: 'قيمة الطلب', value: formatCurrency(orderData.totalAmount) },
                        { label: 'المحصل', value: formatCurrency(orderData.paidAmount) },
                        { label: orderData.closed ? 'الرصيد الأصلي الملغى تحصيله' : 'المتبقي', value: formatCurrency(orderData.remainingAmount) },
                        ...(orderData.closed ? [{ label: 'المتبقي لإعادته للعميل', value: formatCurrency(orderData.refundRemaining) }] : []),
                    ] : []),
                    ...(orderData.printTerms ? [{ label: 'الملاحظات والشروط', value: orderData.printTerms }] : []),
                    ...(orderData.printFooter ? [{ label: 'ملاحظات', value: orderData.printFooter }] : []),
                ],
                qrDataUrl: orderData.qrDataUrl,
                fileName: `sultan-order-${orderData.serialNumber}.pdf`,
            });
        } catch { setError('تعذر إنشاء ملف PDF. أعد المحاولة.'); }
        finally { setLoading(false); }
    };

    const handleWhatsApp = () => {
        // إرسال رسالة نصية مع رابط المستند
        let message = `📋 *مستند الطلب #${orderData.serialNumber}*\n\n👤 العميل: ${orderData.customerName}\n📞 الهاتف: ${orderData.customerPhone}\n\n📝 التفاصيل:\n${orderData.description || 'لا توجد تفاصيل'}\n\n`;

        if (canViewFinancials) {
            message += orderData.closed ? `الحالة: ${orderData.statusLabel}\nالمتبقي لإعادته للعميل: ${formatCurrency(orderData.refundRemaining)}\n\n` : `💰 المبلغ الإجمالي: ${formatCurrency(orderData.totalAmount)}\n✅ المدفوع: ${formatCurrency(orderData.paidAmount)}\n⏳ المتبقي: ${formatCurrency(orderData.remainingAmount)}\n\n`;
        }

        message += `📅 موعد التسليم: ${new Date(orderData.dueDate).toLocaleDateString('ar-LY')}\n\n🔗 رابط المستند:\n${orderData.shareUrl}`;

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="fixed bottom-4 inset-x-4 flex flex-wrap justify-center gap-2 no-print z-50">
            {error && <p role="alert" className="w-full text-center text-red-700 bg-white">{error}</p>}
            <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase  hover:bg-primary/90 transition-all   "
            >
                <Printer className="w-5 h-5" />
                طباعة
            </button>
            <button
                onClick={handleDownloadPDF}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm uppercase  hover:bg-blue-500 transition-all   "
            >
                <Download className="w-5 h-5" />
                {loading ? 'جارٍ إنشاء الملف...' : 'تنزيل PDF'}
            </button>
            <button
                onClick={handleWhatsApp}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold text-sm uppercase  hover:bg-green-500 transition-all   "
            >
                <Share2 className="w-5 h-5" />
                إرسال واتساب
            </button>
        </div>
    );
}
