import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUser } from '@/lib/request-user';
import { issueOrderShareToken, revokeOrderShares } from '@/lib/order-sharing';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser();
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    const { id } = await params;
    const token = await issueOrderShareToken(id, user, 'DIRECT');
    if (!token) return NextResponse.json({ error: 'الطلب غير متاح أو لا تملك صلاحية المشاركة' }, { status: 404 });
    return NextResponse.json({ path: `/orders/share/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}` }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser();
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    const body = z.object({ reason: z.string().trim().min(5, 'اكتب سبب الإلغاء من 5 أحرف على الأقل').max(500) }).safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
    const { id } = await params;
    const revoked = await revokeOrderShares(id, user, body.data.reason);
    if (!revoked) return NextResponse.json({ error: 'الطلب غير متاح أو لا تملك صلاحية الإلغاء' }, { status: 404 });
    return NextResponse.json({ success: true });
}
