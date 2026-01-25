import { prisma } from "../../../../lib/prisma";
import { notFound } from "next/navigation";
import PrintAuto from "./PrintAuto";

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const order = await prisma.order.findUnique({
        where: { id },
        select: {
            serialNumber: true,
            customerName: true,
            customerPhone: true,
            createdAt: true
        }
    });

    if (!order) notFound();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black p-4">
            <PrintAuto />
            <div className="border-4 border-black p-6 rounded-xl text-center w-[300px]">
                <h1 className="text-6xl font-black mb-2 font-mono">{order.serialNumber}</h1>
                <div className="border-t-2 border-black my-4"></div>
                <h2 className="text-xl font-bold mb-1">{order.customerName}</h2>
                <h3 className="text-lg font-mono font-semibold" dir="ltr">{order.customerPhone}</h3>
                <p className="text-xs mt-4 font-mono">{new Date(order.createdAt).toLocaleDateString("ar-EG")}</p>
            </div>
            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { background: white; }
                    .min-h-screen { min-height: 0; }
                }
            `}</style>
        </div>
    );
}
