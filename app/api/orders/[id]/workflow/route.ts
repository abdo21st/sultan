import { z } from 'zod';
import { getRequestUser } from '@/lib/request-user';
import { updateOrderStatus, completeOrder } from '@/lib/actions/orders';
import { ORDER_STATUS } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { moneyAmountSchema } from '@/lib/schemas';

const schema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('change_stage'), status: z.enum([ORDER_STATUS.PROCESSING, ORDER_STATUS.SHOP_READY]) }).strict(),
    z.object({ action: z.literal('request_correction'), reason: z.string().trim().min(5).max(1000) }).strict(),
    z.object({ action: z.literal('deliver'), paymentAmount: moneyAmountSchema.refine(value => value >= 0).default(0), paymentNote: z.string().max(2000).optional() }).strict(),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser();
    if (!user?.permissions.includes(PERMISSIONS.ORDERS_VIEW)) return Response.json({ error: 'غير مصرح' }, { status: 403 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'بيانات الإجراء غير صحيحة. راجع السبب أو مبلغ التحصيل.' }, { status: 400 });
    const data = parsed.data;
    const permission = data.action === 'request_correction' ? PERMISSIONS.STATUS_CHANGE_REVIEW
        : data.action === 'deliver' ? PERMISSIONS.STATUS_CHANGE_COMPLETED
        : data.status === ORDER_STATUS.PROCESSING ? PERMISSIONS.STATUS_CHANGE_PROCESSING : PERMISSIONS.STATUS_CHANGE_SHOP_READY;
    if (!user.permissions.includes(permission)) return Response.json({ error: 'لا تملك صلاحية هذا الإجراء.' }, { status: 403 });
    const { id } = await params;
    const result = data.action === 'deliver' ? await completeOrder(id, data.paymentAmount, data.paymentNote)
        : data.action === 'request_correction' ? await updateOrderStatus(id, ORDER_STATUS.REVIEW, data.reason)
        : await updateOrderStatus(id, data.status);
    return Response.json(result.success ? result : { error: result.error }, { status: result.success ? 200 : 409 });
}
