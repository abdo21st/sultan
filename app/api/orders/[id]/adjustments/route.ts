import { z } from 'zod';
import { getRequestUser } from '@/lib/request-user';
import { AdjustmentError, adjustmentResponse, requestAdjustment } from '@/lib/order-adjustments';
import { PERMISSIONS } from '@/lib/permissions';

const schema = z.object({ kind: z.enum(['CANCEL', 'RETURN']), reason: z.string().trim().min(5).max(1000), requestKey: z.string().uuid() }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser();
    if (!user?.permissions.includes(PERMISSIONS.ORDERS_VIEW)) return Response.json({ error: 'غير مصرح' }, { status: 403 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'أدخل سبباً من 5 إلى 1000 حرف.' }, { status: 400 });
    try { return Response.json(adjustmentResponse(await requestAdjustment(user, (await params).id, parsed.data), user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS))); }
    catch (error) { return Response.json({ error: error instanceof AdjustmentError ? error.message : 'تعذر تسجيل الطلب.' }, { status: error instanceof AdjustmentError ? error.status : 500 }); }
}
