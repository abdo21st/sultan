import { z } from 'zod';
import { getRequestUser } from '@/lib/request-user';
import { AdjustmentError, settleRefund } from '@/lib/order-adjustments';
import { moneyAmountSchema } from '@/lib/schemas';
import { toMoneyNumber } from '@/lib/money';

const schema = z.object({ amount: moneyAmountSchema.refine(amount => amount > 0), note: z.string().trim().min(5).max(500), idempotencyKey: z.string().uuid() }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'أدخل مبلغاً موجباً وملاحظة رد المبلغ من 5 أحرف على الأقل.' }, { status: 400 });
    try { const result = await settleRefund(user, (await params).id, parsed.data); return Response.json({ id: result.id, amount: toMoneyNumber(result.amount) }); }
    catch (error) { return Response.json({ error: error instanceof AdjustmentError ? error.message : 'تعذر تسجيل رد المبلغ.' }, { status: error instanceof AdjustmentError ? error.status : 500 }); }
}
