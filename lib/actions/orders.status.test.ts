jest.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    systemSettings: { findUnique: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn(), count: jest.fn() },
    orderAdjustment: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/request-user", () => ({
  getRequestUser: jest.fn(),
  canAccessOrderFacility: jest.fn(() => true),
  canViewOrderStatus: jest.fn(() => true),
}));

jest.mock("@/lib/services/notification-service", () => ({
  createStatusChangeNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/audit", () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/order-sharing", () => ({ issueOrderShareToken: jest.fn().mockResolvedValue('synthetic-share-token') }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { ORDER_STATUS } from "@/lib/constants";
import { getRequestUser } from "@/lib/request-user";
import { writeAudit } from "@/lib/audit";
import { updateOrderStatus } from "./orders";

const mockPrisma = prisma as unknown as {
  order: {
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  $transaction: jest.Mock;
  $executeRaw: jest.Mock;
  systemSettings: { findFirst: jest.Mock; findUnique: jest.Mock };
  auditLog: { count: jest.Mock; create: jest.Mock };
  orderAdjustment: { findFirst: jest.Mock };
};

const manager = {
  id: "manager-1",
  role: "MANAGER",
  facilityId: "shop-1",
  permissions: [PERMISSIONS.STATUS_CHANGE_PROCESSING],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma));
  mockPrisma.order.findUnique.mockResolvedValue({
    status: ORDER_STATUS.REGISTERED,
    factoryId: "factory-1",
    shopId: "shop-1",
  });
  mockPrisma.order.findUniqueOrThrow.mockResolvedValue({
    id: "order-1",
    status: ORDER_STATUS.DELIVERING_TO_FACTORY,
    factoryId: "factory-1",
    shopId: "shop-1",
  });
  mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.orderAdjustment.findFirst.mockResolvedValue(null);
  mockPrisma.systemSettings.findUnique.mockResolvedValue(null);
  (getRequestUser as jest.Mock).mockResolvedValue(manager);
});

describe("updateOrderStatus", () => {
  it('uses an execution-only advisory lock before a configured WhatsApp send', async () => {
    const previousFetch = global.fetch;
    const previousHosts = process.env.WHATSAPP_API_ALLOWED_HOSTS;
    const previousBase = process.env.AUTH_URL;
    const previousNextBase = process.env.NEXTAUTH_URL;
    try {
      process.env.WHATSAPP_API_ALLOWED_HOSTS = 'provider.example.test';
      process.env.AUTH_URL = 'https://sultan.example.test';
      process.env.NEXTAUTH_URL = 'https://sultan.example.test';
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      (getRequestUser as jest.Mock).mockResolvedValue({ ...manager, permissions: [PERMISSIONS.STATUS_CHANGE_PROCESSING, PERMISSIONS.WHATSAPP_SEND] });
      mockPrisma.order.findUnique.mockResolvedValue({ status: ORDER_STATUS.DELIVERING_TO_FACTORY, factoryId: 'factory-1', shopId: 'shop-1' });
      mockPrisma.order.findUniqueOrThrow.mockResolvedValue({ id: 'order-1', serialNumber: 1, customerName: 'Synthetic', customerPhone: '0910000000', factoryId: 'factory-1', shopId: 'shop-1' });
      mockPrisma.systemSettings.findFirst.mockResolvedValue({ whatsappAutoSend: true, whatsappApiUrl: 'https://provider.example.test/send', whatsappApiKey: 'synthetic-key' });
      mockPrisma.auditLog.count.mockResolvedValue(0);
      (writeAudit as jest.Mock).mockResolvedValue('attempt-1');
      expect((await updateOrderStatus('order-1', ORDER_STATUS.PROCESSING)).success).toBe(true);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'WHATSAPP_SEND_RESULT', after: { status: 'SENT', httpStatus: 200 } }) }));
    } finally {
      global.fetch = previousFetch;
      if (previousHosts === undefined) delete process.env.WHATSAPP_API_ALLOWED_HOSTS; else process.env.WHATSAPP_API_ALLOWED_HOSTS = previousHosts;
      if (previousBase === undefined) delete process.env.AUTH_URL; else process.env.AUTH_URL = previousBase;
      if (previousNextBase === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = previousNextBase;
    }
  });

  it("rejects a transition outside the workflow before writing", async () => {
    const result = await updateOrderStatus("order-1", ORDER_STATUS.SHOP_READY);

    expect(result.success).toBe(false);
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("rejects a transition when the user lacks its specific permission", async () => {
    (getRequestUser as jest.Mock).mockResolvedValue({ ...manager, permissions: [] });

    const result = await updateOrderStatus("order-1", ORDER_STATUS.DELIVERING_TO_FACTORY);

    expect(result.success).toBe(false);
    expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("uses the current status as a compare-and-set guard and audits only the concurrent winner", async () => {
    mockPrisma.order.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.all([
      updateOrderStatus("order-1", ORDER_STATUS.PROCESSING),
      updateOrderStatus("order-1", ORDER_STATUS.PROCESSING),
    ]);

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => !result.success)).toHaveLength(1);
    expect(mockPrisma.order.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: ORDER_STATUS.REGISTERED, reviewRequired: false },
      data: { status: ORDER_STATUS.PROCESSING, rejectionReason: null },
    });
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });
});
