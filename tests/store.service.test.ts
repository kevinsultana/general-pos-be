import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreService } from '../src/modules/store/store.service.js';
import { prisma } from '../src/config/prisma.js';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    store: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../src/modules/audit/audit.service.js', () => ({
  AuditService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('StoreService - Store Profile Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates basic store profile successfully without error', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 'store-1',
      name: 'Toko Lama',
    });
    (prisma.store.update as any).mockResolvedValue({
      id: 'store-1',
      name: 'Toko Baru',
      address: 'Jl. Melati No. 5',
      phone: '08123456789',
    });

    const result = await StoreService.updateStore(
      'store-1',
      {
        name: 'Toko Baru',
        address: 'Jl. Melati No. 5',
        phone: '08123456789',
        receiptFooter: 'Terima kasih telah berkunjung!',
      },
      'owner-user-id'
    );

    expect(result.name).toBe('Toko Baru');
    expect(result.receiptFooter).toBe('Terima kasih telah berkunjung!');
    expect(prisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'store-1' },
        data: expect.objectContaining({
          name: 'Toko Baru',
          address: 'Jl. Melati No. 5',
          phone: '08123456789',
        }),
      })
    );
  });
});
