'use client';

import { Printer, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
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

    const handleWhatsApp = async () => {
        setLoading(true);
        try {
            // 1. تحويل الصفحة إلى صورة
            const printArea = document.getElementById('print-area');
            if (!printArea) {
                alert('لم يتم العثور على منطقة الطباعة');
                return;
            }

            const canvas = await html2canvas(printArea, {
                scale: 2, // جودة عالية
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    // إزالة أي عناصر قد تسبب مشاكل
                    const clonedArea = clonedDoc.getElementById('print-area');
                    if (clonedArea) {
                        // إزالة الأزرار من النسخة المستنسخة
                        const buttons = clonedArea.querySelectorAll('.no-print');
                        buttons.forEach(btn => btn.remove());
                    }
                }
            });

            // 2. تحويل Canvas إلى Blob
            canvas.toBlob((blob) => {
                if (!blob) {
                    alert('حدث خطأ أثناء إنشاء الصورة');
                    return;
                }

                // 3. تحميل الصورة
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `طلب-${orderData.serialNumber}.png`;
                link.click();
                URL.revokeObjectURL(url);

                // 4. فتح واتساب مع رسالة
                setTimeout(() => {
                    const message = `📋 *مستند الطلب #${orderData.serialNumber}*\n\n👤 العميل: ${orderData.customerName}\n💰 المبلغ: ${orderData.totalAmount.toLocaleString()} د.ل\n\n✅ تم تحميل صورة المستند، يمكنك إرفاقها الآن`;
                    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                    window.open(whatsappUrl, '_blank');
                }, 500);
            }, 'image/png');

        } catch (error) {
            console.error('Error:', error);
            alert('حدث خطأ أثناء إنشاء الصورة');
        } finally {
            setLoading(false);
        }
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
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-green-500 transition-all shadow-lg shadow-green-500/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        جاري التحميل...
                    </>
                ) : (
                    <>
                        <Share2 className="w-5 h-5" />
                        تحميل وإرسال
                    </>
                )}
            </button>
        </div>
    );
}
