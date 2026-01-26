import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function GET() {
    try {
        // Test connection
        await prisma.$connect();

        // Count users
        const userCount = await prisma.user.count();

        // Find master
        const masterUser = await prisma.user.findUnique({
            where: { username: 'master' },
        });

        let passwordMatch = false;
        if (masterUser) {
            passwordMatch = await bcrypt.compare('ms2052', masterUser.password);
        }

        return NextResponse.json({
            success: true,
            status: 'Database connected',
            userCount,
            masterFound: !!masterUser,
            masterId: masterUser?.id,
            passwordMatchAgainst_ms2052: passwordMatch,
            // Masked hash part for verification
            hashStart: masterUser?.password.substring(0, 7) + '...'
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
