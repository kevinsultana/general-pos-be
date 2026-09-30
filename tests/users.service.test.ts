import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '../src/modules/users/users.service.js';
import { prisma } from '../src/config/prisma.js';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    store: {
      findUnique: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../src/modules/audit/audit.service.js', () => ({
  AuditService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../src/utils/password.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password_mock'),
}));

describe('UsersService - Staff Quota Entitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects user creation when store is on FREE plan and already has an active user', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 'store-free-1',
      subscriptionPlan: 'FREE',
    });
    (prisma.user.count as any).mockResolvedValue(1);

    await expect(
      UsersService.createUser(
        'store-free-1',
        {
          username: 'cashier_test',
          password: 'password123',
          displayName: 'Kasir Tambahan',
          roleId: '00000000-0000-0000-0000-000000000001',
        },
        'owner-user-id'
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'SUBSCRIPTION_REQUIRED',
      message: expect.stringContaining('FREE'),
    });
  });

  it('allows user creation when store is on PRO plan', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 'store-pro-1',
      subscriptionPlan: 'PRO',
    });
    (prisma.user.findFirst as any).mockResolvedValue(null);
    (prisma.role.findFirst as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Cashier',
    });
    (prisma.user.create as any).mockResolvedValue({
      id: 'user-new-id',
      username: 'cashier_pro',
      displayName: 'Kasir Pro',
      email: null,
      active: true,
      role: { id: '00000000-0000-0000-0000-000000000002', name: 'Cashier' },
      createdAt: new Date(),
    });

    const result = await UsersService.createUser(
      'store-pro-1',
      {
        username: 'cashier_pro',
        password: 'password123',
        displayName: 'Kasir Pro',
        roleId: '00000000-0000-0000-0000-000000000002',
      },
      'owner-user-id'
    );

    expect(result.id).toBe('user-new-id');
    expect(result.username).toBe('cashier_pro');
  });
});
