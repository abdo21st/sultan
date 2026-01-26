import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Test connection
        await prisma.$connect();

        // Count users
        const userCount = await prisma.user.count();

        // Find master
        const masterUser = await prisma.user.findUnique({
            where: { username: 'master' },
            select: { id: true, username: true }
        });

        return NextResponse.json({
            success: true,
            status: 'Database connected',
            userCount,
            masterFound: !!masterUser,
            masterId: masterUser?.id
        });
    } catch (error: any) {
        console.error('Diagnostic error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
