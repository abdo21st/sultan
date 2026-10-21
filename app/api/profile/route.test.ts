/** @jest-environment node */
jest.mock('@/lib/request-user', () => ({ getRequestUser: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn(), updateMany: jest.fn() }, $transaction: jest.fn() } }));
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn() }));
jest.mock('bcryptjs', () => ({ __esModule: true, default: { compare: jest.fn(), hash: jest.fn() } }));

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getRequestUser } from '@/lib/request-user';
import { PATCH } from './route';

const record = { id: 'u1', password: 'old-hash', mustChangePassword: true, sessionVersion: 3 };
const request = (newPassword = 'replacement-password-123') => new Request('http://localhost/api/profile', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: 'initial-password-123', newPassword }),
});

beforeEach(() => {
    jest.resetAllMocks();
    (getRequestUser as jest.Mock).mockResolvedValue({ id: 'u1', sessionVersion: 3 });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(record);
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.$transaction as jest.Mock).mockImplementation(callback => callback(prisma));
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
});

it('clears the mandatory flag, revokes sessions and audits only a successful guarded write', async () => {
    const response = await PATCH(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reauthenticate: true });
    expect(getRequestUser).toHaveBeenCalledWith({ allowPasswordChange: true });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'u1', password: 'old-hash', sessionVersion: 3 }, data: { password: 'new-hash', mustChangePassword: false, sessionVersion: { increment: 1 } } });
    expect(writeAudit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((writeAudit as jest.Mock).mock.calls)).not.toContain('old-hash');
});

it('rejects a competing password reset without an audit or overwrite', async () => {
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    expect((await PATCH(request())).status).toBe(409);
    expect(writeAudit).not.toHaveBeenCalled();
});

it('rejects an incorrect current password', async () => {
    (bcrypt.compare as jest.Mock).mockReset().mockResolvedValue(false);
    expect((await PATCH(request())).status).toBe(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
});

it('rejects reuse of the current password', async () => {
    (bcrypt.compare as jest.Mock).mockReset().mockResolvedValue(true);
    expect((await PATCH(request())).status).toBe(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
});

it('rejects a password beyond the bcrypt UTF-8 limit', async () => {
    expect((await PATCH(request('ض'.repeat(40)))).status).toBe(400);
    expect(bcrypt.hash).not.toHaveBeenCalled();
});

it('accepts exactly six characters and still revokes prior sessions', async () => {
    expect((await PATCH(request('A1!b2c'))).status).toBe(200);
    expect(bcrypt.hash).toHaveBeenCalledWith('A1!b2c', 12);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { password: 'new-hash', mustChangePassword: false, sessionVersion: { increment: 1 } } }));
});

it('rejects five characters before hashing or writing', async () => {
    expect((await PATCH(request('A1!b2'))).status).toBe(400);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
});
