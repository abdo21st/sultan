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
            console.log('بدء تحويل المستند إلى صورة...');

            // 1. تحويل الصفحة إلى صورة
            const printArea = document.getElementById('print-area');
            if (!printArea) {
                console.error('لم يتم العثور على print-area');
                alert('لم يتم العثور على منطقة الطباعة');
                setLoading(false);
                return;
            }

            console.log('تم العثور على print-area، بدء html2canvas...');

            const canvas = await html2canvas(printArea, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: true,
                backgroundColor: '#ffffff',
                windowWidth: printArea.scrollWidth,
                windowHeight: printArea.scrollHeight
            });

            console.log('تم إنشاء Canvas بنجاح!', canvas.width, 'x', canvas.height);

            // 2. تحويل Canvas إلى Blob
            canvas.toBlob((blob) => {
                if (!blob) {
                    console.error('فشل إنشاء Blob');
                    alert('حدث خطأ أثناء إنشاء الصورة');
                    setLoading(false);
                    return;
                }

                console.log('تم إنشاء Blob بنجاح!', blob.size, 'bytes');

                // 3. تحميل الصورة
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `طلب-${orderData.serialNumber}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                console.log('تم تحميل الصورة بنجاح!');

                // 4. فتح واتساب مع رسالة
                setTimeout(() => {
                    const message = `📋 *مستند الطلب #${orderData.serialNumber}*\n\n👤 العميل: ${orderData.customerName}\n💰 المبلغ: ${orderData.totalAmount.toLocaleString()} د.ل\n\n✅ تم تحميل صورة المستند، يمكنك إرفاقها الآن`;
                    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                    console.log('فتح واتساب...');
                    window.open(whatsappUrl, '_blank');
                    setLoading(false);
                }, 500);
            }, 'image/png');

        } catch (error) {
            console.error('خطأ في handleWhatsApp:', error);
            alert('حدث خطأ أثناء إنشاء الصورة: ' + (error as Error).message);
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
