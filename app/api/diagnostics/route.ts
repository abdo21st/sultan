import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET() {
    try {
        const session = await auth();

        const userCount = await prisma.user.count();
        const roleCount = await prisma.customRole.count();

        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                displayName: true,
                role: true,
                permissions: true,
                roles: {
                    select: {
                        id: true,
                        name: true,
                        displayName: true,
                        permissions: true
                    }
                }
            }
        });

        const roles = await prisma.customRole.findMany();

        return NextResponse.json({
            session: {
                user: session?.user || null,
                isAuthenticated: !!session
            },
            database: {
                userCount,
                roleCount,
                users,
                roles
            },
            bootstrap: {
                isBootstrapMode: userCount === 0 || roleCount === 0,
                canAccessUsers: userCount === 0,
                canAccessRoles: roleCount === 0
            }
        });
    } catch (error) {
        return NextResponse.json({
            error: String(error),
            message: 'Failed to fetch diagnostics'
        }, { status: 500 });
    }
}
