import { prisma } from "../../../../lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import PrintAndShareButtons from "../../../components/PrintAndShareButtons";
import QRCode from "qrcode";

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            factory: true,
            shop: true
        }
    });

    const settings = await prisma.systemSettings.findFirst();

    if (!order) notFound();

    // Generate QR Code data (linking to the digital order page)
    const baseUrl = process.env.NEXTAUTH_URL || "https://sultan23.vercel.app";
    const orderUrl = `${baseUrl}/orders/${order.id}`;
    const qrCodeDataUrl = await QRCode.toDataURL(orderUrl, {
        margin: 1,
        width: 120,
        color: {
            dark: "#000000",
            light: "#ffffff"
        }
    });

    return (
        <div className="p-8 max-w-4xl mx-auto bg-white text-black min-h-screen relative" id="print-area">
            {/* Decorative Gold Header Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-700 via-amber-400 to-amber-700 no-print" />

            {/* Header */}
            <div className="flex justify-between items-center border-b-4 border-amber-600/20 pb-8 mb-10 mt-4">
                <div className="flex items-center gap-6">
                    {settings?.logoUrl ? (
                        <div className="relative w-24 h-24 border-2 border-amber-600/10 rounded-2xl p-2 shadow-sm">
                            <Image src={settings.logoUrl} alt="Logo" fill className="object-contain" />
                        </div>
                    ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-amber-600 to-amber-900 rounded-2xl flex items-center justify-center text-white font-black text-4xl shadow-gold">
                            {settings?.appName?.[0] || 'س'}
                        </div>
                    )}
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-zinc-900 tracking-tighter">{settings?.appName || "سلطان"}</h1>
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] leading-tight">للأثاث والمفروشات الفاخرة</p>
                        {settings?.printHeader && (
                            <p className="text-sm text-zinc-500 font-medium max-w-sm leading-relaxed mt-2">{settings.printHeader}</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                    <div className="bg-zinc-900 text-white px-6 py-3 rounded-2xl text-center shadow-lg">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">رقم الطلب التسلسلي</p>
                        <p className="text-2xl font-black font-mono">#{order.serialNumber}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">تاريخ الاستخراج</p>
                        <p className="text-xs font-bold text-zinc-900">{new Date().toLocaleDateString("ar-LY", { dateStyle: 'full' })}</p>
                    </div>
                </div>
            </div>

            {/* Main Info Section */}
            <div className="grid grid-cols-12 gap-10 mb-12">
                <div className="col-span-12 md:col-span-8 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        <section className="space-y-3">
                            <h2 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                بيانات العميل المعتمد
                            </h2>
                            <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200/60 shadow-inner">
                                <p className="font-black text-xl text-zinc-900 mb-1">{order.customerName}</p>
                                <p className="text-zinc-500 font-bold font-mono text-sm tracking-tight" dir="ltr">{order.customerPhone}</p>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                تفاصيل التوقيت والمقر
                            </h2>
                            <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200/60 flex flex-col justify-center gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">التسليم:</span>
                                    <span className="font-black text-zinc-900 text-sm whitespace-nowrap">{new Date(order.dueDate).toLocaleDateString("ar-LY", { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">المقر:</span>
                                    <span className="font-black text-amber-700 text-sm">{order.factory?.name || 'مقر عام'}</span>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="space-y-3">
                        <h2 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            الوصف التقني والطلبات الخاصة
                        </h2>
                        <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200/60 min-h-[160px] shadow-inner">
                            <p className="text-sm font-medium text-zinc-800 leading-loose whitespace-pre-wrap">{order.description}</p>
                        </div>
                    </section>
                </div>

                <div className="col-span-12 md:col-span-4 flex flex-col items-center justify-center p-6 bg-amber-50/50 rounded-[2.5rem] border border-amber-200/40">
                    <div className="relative w-36 h-36 bg-white p-3 rounded-3xl shadow-gold mb-4">
                        <Image src={qrCodeDataUrl} alt="Order QR Code" fill className="p-2" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest">امسح الكود للتتبع</p>
                        <p className="text-[9px] font-bold text-amber-600/60 uppercase tracking-tighter">رابط الطلب الرقمي المعتمد</p>
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-zinc-900 text-white rounded-[2rem] p-10 flex flex-wrap justify-between items-center mb-12 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/10 rounded-full blur-2xl -mr-10 -mt-10" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-600/10 rounded-full blur-2xl -ml-10 -mb-10" />

                <div className="relative">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">إجمالي الالتزام المالي</p>
                    <p className="text-4xl font-black font-mono tracking-tighter" dir="ltr">{order.totalAmount.toLocaleString()} <span className="text-xs text-white/50 tracking-normal opacity-100">د.ل</span></p>
                </div>
                <div className="relative border-x border-white/10 px-12 group-hover:px-16 transition-all duration-700">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-500 mb-2">ما تم تحصيله</p>
                    <p className="text-4xl font-black font-mono text-green-500 tracking-tighter" dir="ltr">{order.paidAmount.toLocaleString()} <span className="text-xs text-green-500/50 tracking-normal">د.ل</span></p>
                </div>
                <div className="relative text-left">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 text-right mb-2">الرصيد المتبقي</p>
                    <p className="text-4xl font-black font-mono text-red-500 tracking-tighter" dir="ltr">{order.remainingAmount.toLocaleString()} <span className="text-xs text-red-500/50 tracking-normal">د.ل</span></p>
                </div>
            </div>

            {/* Terms and Signatures */}
            <div className="mt-auto pt-10 grid grid-cols-2 gap-10 items-end">
                <div className="space-y-6">
                    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 border-dashed">
                        <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 text-center">الشروط والأحكام</h4>
                        <ol className="text-[8px] text-zinc-500 space-y-1 pr-4 list-decimal leading-relaxed">
                            <li>يعتبر استلام العميل للمستند بمثابة موافقة على المواصفات المذكورة أعلاه.</li>
                            <li>لا يتم البدء في التنفيذ إلا بعد سداد المبلغ المتفق عليه كدفعة أولى.</li>
                            <li>تاريخ الاستلام تقريبي ويخضع لظروف التوريد والعمالة.</li>
                            <li>لا يحق للعميل المطالبة باسترداد العربون بعد مرور 48 ساعة من تاريخ الطلب.</li>
                        </ol>
                    </div>
                </div>

                <div className="flex flex-col gap-10 items-end">
                    <div className="w-full h-px bg-gradient-to-l from-zinc-200/50 via-zinc-200 to-zinc-200/50" />
                    <div className="flex justify-between w-full text-[10px] items-center">
                        <div className="text-right space-y-2">
                            <p className="font-bold text-zinc-400 uppercase tracking-widest">توقيع المستلم المعتمد</p>
                            <p className="text-lg font-black text-zinc-800">...............................</p>
                        </div>
                        <div className="text-right space-y-2">
                            <p className="font-bold text-zinc-400 uppercase tracking-widest">توقيع محاسب النظام</p>
                            <p className="text-lg font-black text-zinc-800">...............................</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Credits */}
            <div className="mt-12 pt-6 border-t border-zinc-100 flex justify-between items-center">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.3em]">SULTAN ERP SYSTEM • PRECISE INTERIORS</p>
                <div className="text-left">
                    {settings?.printFooter ? (
                        <p className="text-[10px] font-bold text-zinc-500 whitespace-pre-line leading-relaxed">{settings.printFooter}</p>
                    ) : (
                        <p className="text-[10px] font-bold text-zinc-500">شكراً لاختياركم فخامة سلطان • 2026</p>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0 !important; }
                    #print-area { padding: 40px !important; width: 100% !important; max-width: none !important; margin: 0 !important; box-shadow: none !important; }
                    .shadow-gold, .shadow-2xl, .shadow-lg { box-shadow: none !important; }
                    .bg-zinc-900 { background-color: #18181b !important; -webkit-print-color-adjust: exact; }
                    .text-green-500 { color: #22c55e !important; -webkit-print-color-adjust: exact; }
                    .text-red-500 { color: #ef4444 !important; -webkit-print-color-adjust: exact; }
                    .bg-amber-50\\/50 { background-color: #fffbeb !important; -webkit-print-color-adjust: exact; }
                    .bg-zinc-50 { background-color: #fafafa !important; -webkit-print-color-adjust: exact; }
                }
            `}} />

            <div className="no-print mt-12 flex justify-center">
                <PrintAndShareButtons
                    orderData={{
                        serialNumber: order.serialNumber,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        description: order.description,
                        totalAmount: order.totalAmount,
                        paidAmount: order.paidAmount,
                        remainingAmount: order.remainingAmount,
                        dueDate: order.dueDate,
                        orderId: order.id
                    }}
                />
            </div>
        </div>
    );
}

