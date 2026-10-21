// Run once during an upgrade. Credentials arrive through stdin, never command arguments.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { newPasswordSchema } from '../lib/password-policy';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
    let input = '';
    for await (const chunk of process.stdin) {
        input += chunk.toString();
        if (Buffer.byteLength(input) > 4096) throw new Error('Invalid credential input.');
    }
    const { username, initialPassword } = JSON.parse(input);
    if (typeof username !== 'string' || !newPasswordSchema.safeParse(initialPassword).success) throw new Error('Invalid credential input.');
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.role !== 'ADMIN' || !await bcrypt.compare(initialPassword, user.password)) {
        console.log(JSON.stringify({ status: 'preserved', reason: 'INITIAL_CREDENTIAL_NO_LONGER_MATCHES' }));
        return;
    }
    if (user.mustChangePassword) { console.log(JSON.stringify({ status: 'already_required' })); return; }
    const changed = await prisma.$transaction(async tx => {
        const result = await tx.user.updateMany({
            where: { id: user.id, password: user.password, sessionVersion: user.sessionVersion, mustChangePassword: false },
            data: { mustChangePassword: true, sessionVersion: { increment: 1 } },
        });
        if (result.count !== 1) return false;
        await tx.auditLog.create({ data: {
            actorId: user.id, entityType: 'USER', entityId: user.id, action: 'INITIAL_PASSWORD_ENROLLED',
            after: { mustChangePassword: true, sessionsRevoked: true },
        } });
        return true;
    });
    console.log(JSON.stringify({ status: changed ? 'enrolled' : 'preserved', reason: changed ? 'INITIAL_CREDENTIAL_STILL_IN_USE' : 'CONCURRENT_ACCOUNT_CHANGE' }));
}

main().catch(() => { console.error('Initial administrator enrollment failed. No credentials were logged.'); process.exitCode = 1; })
    .finally(async () => { await prisma.$disconnect(); await pool.end(); });
