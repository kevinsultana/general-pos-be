import { prisma } from '../../config/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateStoreInput } from './store.schemas.js';

export class StoreService {
  static async getStore(storeId: string) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Toko tidak ditemukan' };
    }

    return store;
  }

  static async updateStore(storeId: string, input: UpdateStoreInput, currentUserId: string) {
    const existing = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Toko tidak ditemukan' };
    }

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: input,
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'UPDATE_STORE_SETTINGS',
      entityType: 'Store',
      entityId: storeId,
      afterData: input,
    });

    return updated;
  }
}
