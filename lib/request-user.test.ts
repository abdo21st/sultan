/** @jest-environment node */
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from './request-user';

beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', sessionVersion: 2 } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', username: 'user', role: 'USER', permissions: [], facilityId: null, roles: [], mustChangePassword: false, sessionVersion: 2 });
});

it('denies a revoked session even if a preceding authentication check passed', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', sessionVersion: 1 } });
    expect(await getRequestUser()).toBeNull();
    expect(await getRequestUser({ allowPasswordChange: true })).toBeNull();
});

it('denies business operations until the initial password changes', async () => {
    const record = await prisma.user.findUnique({ where: { id: 'u1' } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...record, mustChangePassword: true });
    expect(await getRequestUser()).toBeNull();
    expect((await getRequestUser({ allowPasswordChange: true }))?.id).toBe('u1');
});

it('allows a current session after its mandatory change', async () => {
    expect((await getRequestUser())?.id).toBe('u1');
});
