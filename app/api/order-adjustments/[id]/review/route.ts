import { z } from 'zod';
import { getRequestUser } from '@/lib/request-user';
import { AdjustmentError, adjustmentResponse, reviewAdjustment } from '@/lib/order-adjustments';

const schema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().trim().min(5).max(1000) }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'أدخل ملاحظة المراجعة من 5 إلى 1000 حرف.' }, { status: 400 });
    try { return Response.json(adjustmentResponse(await reviewAdjustment(user, (await params).id, parsed.data), true)); }
    catch (error) { return Response.json({ error: error instanceof AdjustmentError ? error.message : 'تعذر تسجيل قرار المدير.' }, { status: error instanceof AdjustmentError ? error.status : 500 }); }
}
