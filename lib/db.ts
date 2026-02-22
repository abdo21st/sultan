import Dexie, { type Table } from 'dexie';

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
    createdAt: number;
}

export class AppDatabase extends Dexie {
    orders!: Table<OfflineOrder>;

    constructor() {
        super('SultanAppDB');
        this.version(1).stores({
            orders: '++id, status, createdAt' // Primary key and indexed fields
        });
    }
}

export const db = new AppDatabase();
