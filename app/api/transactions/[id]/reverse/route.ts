import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUser } from '@/lib/request-user';
import { ReversalError, reverseTransaction } from '@/lib/transaction-reversal';
import { toMoneyNumber } from '@/lib/money';

const schema = z.object({
    reason: z.string().trim().min(5, 'اكتب سبب التصحيح من 5 أحرف على الأقل').max(500)
        .refine(value => [...value].length >= 5, 'اكتب سبب التصحيح من 5 أحرف على الأقل'),
    idempotencyKey: z.string().uuid(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser();
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
    try {
        const { id } = await params;
        const reversal = await reverseTransaction(user, id, body.data.reason, body.data.idempotencyKey);
        return NextResponse.json({ ...reversal, amount: toMoneyNumber(reversal.amount), order: undefined });
    } catch (error) {
        if (error instanceof ReversalError) {
            const errors = {
                NOT_FOUND: [404, 'الحركة غير متاحة'], FORBIDDEN: [403, 'لا تملك صلاحية عكس هذه الحركة'],
                ALREADY_REVERSED: [409, 'سبق عكس هذه الحركة'], REVERSAL_OF_REVERSAL: [409, 'لا يمكن عكس قيد عكسي؛ سجّل حركة صحيحة جديدة'],
                IDEMPOTENCY_CONFLICT: [409, 'استُخدم مفتاح العملية لطلب مختلف'],
                LEDGER_MISMATCH: [409, 'رصيد الطلب لا يطابق سجل التحصيل؛ يلزم إجراء مصالحة قبل التصحيح'],
                CONCURRENT_CHANGE: [409, 'تزامنت عملية أخرى؛ أعد المحاولة بنفس مفتاح العملية'],
            } as const;
            const [status, message] = errors[error.code];
            return NextResponse.json({ error: message, code: error.code }, { status });
        }
        console.warn('Transaction reversal failed.', { errorType: error instanceof Error ? error.name : 'UnknownError' });
        return NextResponse.json({ error: 'تعذر تسجيل القيد العكسي' }, { status: 500 });
    }
}
