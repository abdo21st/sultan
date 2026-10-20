import Dexie, { type Table } from 'dexie';

export interface OfflineFacility {
    id: string;
    name: string;
    type: 'FACTORY' | 'SHOP';
}

export interface FacilitySnapshot {
    key: 'current';
    scope: string;
    updatedAt: number;
    facilities: OfflineFacility[];
}

export interface OfflineOrder {
    id?: number;
    customerName: string;
    customerPhone: string;
    description: string;
    totalAmount: string;
    paidAmount: string;
    dueDate: string;
    factoryId: string;
    shopId: string;
    images: Blob[]; // Store images as Blobs in IndexedDB
    status: 'pending' | 'syncing' | 'failed';
    idempotencyKey: string;
    attempts: number;
    nextAttemptAt: number;
    syncingAt?: number;
    lastError?: string;
    lastStatus?: number;
    createdAt: number;
}

export class AppDatabase extends Dexie {
    orders!: Table<OfflineOrder>;
    facilityCache!: Table<FacilitySnapshot, string>;

    constructor() {
        super('SultanAppDB');
        this.version(1).stores({
            orders: '++id, status, createdAt' // Primary key and indexed fields
        });
        this.version(2).stores({
            orders: '++id, status, createdAt, nextAttemptAt'
        }).upgrade(async (transaction) => {
            await transaction.table('orders').toCollection().modify((order: OfflineOrder) => {
                order.idempotencyKey ||= crypto.randomUUID();
                order.attempts ||= 0;
                order.nextAttemptAt ||= 0;
                if (order.status === 'syncing') {
                    order.status = 'failed';
                    order.nextAttemptAt = 0;
                }
            });
        });
        this.version(3).stores({
            orders: '++id, status, createdAt, nextAttemptAt',
            facilityCache: '&key',
        });
    }
}

export const db = new AppDatabase();
