import { prisma } from './prisma';
import { SharedNotificationStream } from './shared-notification-stream';
import { createNotificationRepository } from './notification-stream-repository';
const shared = globalThis as typeof globalThis & { sultanNotificationStream?: SharedNotificationStream };
export const notificationStream = shared.sultanNotificationStream ??= new SharedNotificationStream(createNotificationRepository(prisma));
