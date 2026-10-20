jest.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    systemSettings: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/request-user", () => ({
  getRequestUser: jest.fn(),
  canAccessOrderFacility: jest.fn(() => true),
}));

jest.mock("@/lib/services/notification-service", () => ({
  createStatusChangeNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/audit", () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }));
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
};

const manager = {
  id: "manager-1",
  role: "MANAGER",
  facilityId: "shop-1",
  permissions: [PERMISSIONS.STATUS_CHANGE_DELIVERING_TO_FACTORY],
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
  (getRequestUser as jest.Mock).mockResolvedValue(manager);
});

describe("updateOrderStatus", () => {
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
      updateOrderStatus("order-1", ORDER_STATUS.DELIVERING_TO_FACTORY),
      updateOrderStatus("order-1", ORDER_STATUS.DELIVERING_TO_FACTORY),
    ]);

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => !result.success)).toHaveLength(1);
    expect(mockPrisma.order.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: ORDER_STATUS.REGISTERED },
      data: { status: ORDER_STATUS.DELIVERING_TO_FACTORY, rejectionReason: null },
    });
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });
});
