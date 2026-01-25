import { prisma } from "../../../../lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import PrintButton from "../../../components/PrintButton";

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            factory: true,
            shop: true
        }
    });

    if (!order) notFound();

    return (
        <div className="p-8 max-w-4xl mx-auto bg-white text-black min-h-screen" id="print-area">
            {/* Header */}
            <div className="flex justify-between items-center border-b-2 border-primary pb-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">S</div>
                    <div>
                        <h1 className="text-2xl font-bold">مغسلة ومنجرة سلطان</h1>
                        <p className="text-sm text-zinc-600">للأثاث والمفروشات الحديثة</p>
                    </div>
                </div>
                <div className="text-left font-mono">
                    <p className="font-bold text-xl">#{order.serialNumber}</p>
                    <p className="text-xs">التاريخ: {new Date(order.createdAt).toLocaleDateString("ar-LY")}</p>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                    <section>
                        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-1">بيانات العميل</h2>
                        <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                            <p className="font-bold text-lg">{order.customerName}</p>
                            <p className="text-zinc-600 font-mono" dir="ltr">{order.customerPhone}</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-1">تفاصيل الموعد</h2>
                        <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                            <div className="flex justify-between">
                                <span className="text-zinc-600">موعد التسليم:</span>
                                <span className="font-bold">{new Date(order.dueDate).toLocaleDateString("ar-LY")}</span>
                            </div>
                            <div className="flex justify-between mt-2">
                                <span className="text-zinc-600">المكان:</span>
                                <span className="font-bold">{order.factory?.name || 'عام'}</span>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="space-y-4">
                    <section>
                        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-1">الوصف والطلبات</h2>
                        <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 min-h-[140px]">
                            <p className="text-sm whitespace-pre-wrap">{order.description}</p>
                        </div>
                    </section>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-zinc-900 text-white rounded-xl p-6 flex justify-between items-center mb-8">
                <div>
                    <p className="text-xs opacity-70">إجمالي المبلغ</p>
                    <p className="text-2xl font-bold font-mono" dir="ltr">{order.totalAmount.toLocaleString()} د.ل</p>
                </div>
                <div className="border-x border-white/20 px-8">
                    <p className="text-xs opacity-70">المبلغ المدفوع</p>
                    <p className="text-2xl font-bold font-mono text-green-400" dir="ltr">{order.paidAmount.toLocaleString()} د.ل</p>
                </div>
                <div className="text-left">
                    <p className="text-xs opacity-70 text-right">المتبقي للدفع</p>
                    <p className="text-2xl font-bold font-mono text-red-400" dir="ltr">{order.remainingAmount.toLocaleString()} د.ل</p>
                </div>
            </div>

            {/* Images */}
            {order.images && (order.images as string[]).length > 0 && (
                <div className="mt-8 pt-8 border-t border-zinc-100">
                    <h2 className="text-lg font-bold mb-4">صور المرفقات</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {(order.images as string[]).map((img, idx) => (
                            <div key={idx} className="relative border rounded-xl overflow-hidden shadow-sm h-64 w-full bg-zinc-100">
                                <Image
                                    src={img}
                                    alt={`order asset ${idx + 1}`}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="mt-auto pt-12 text-center text-xs text-zinc-400 border-t border-zinc-100 flex justify-between items-end">
                <div className="text-right">
                    <p>المستلم: ...............................</p>
                    <p className="mt-1">التوقيع: ...............................</p>
                </div>
                <div>
                    <p>شكراً لتعاملكم مع سلطان للأثاث</p>
                    <p className="mt-1">ليبيا - طرابلس</p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    #print-area { padding: 0 !important; width: 100% !important; max-width: none !important; }
                }
            `}} />

            <PrintButton />
        </div>
    );
}
