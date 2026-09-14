import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

const app = createApp();

let authToken: string;
let testStoreId: string;
let testUserId: string;
let testProductId: string;

describe('Phase 13 & 14: Subscription Entitlements & Concurrency Hardening', () => {
  beforeAll(async () => {
    // 1. Create unique test store
    const store = await prisma.store.create({
      data: {
        name: `Entitlement Test Store ${Date.now()}`,
        subscriptionPlan: 'PRO',
        subscriptionStatus: 'ACTIVE',
      },
    });
    testStoreId = store.id;

    // 2. Create admin role
    const role = await prisma.role.create({
      data: {
        storeId: testStoreId,
        name: 'Owner Admin',
      },
    });

    // 3. Grant permissions
    const permissions = await prisma.permission.findMany({
      where: { key: { in: ['sync_data', 'view_reports', 'create_transaction'] } },
    });
    for (const p of permissions) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }

    // 4. Create user
    const user = await prisma.user.create({
      data: {
        storeId: testStoreId,
        roleId: role.id,
        username: `entitle_user_${Date.now()}`,
        displayName: 'Entitlement Owner',
        passwordHash: 'dummyhash',
      },
    });
    testUserId = user.id;

    // 5. Create test product with stock = 2
    const category = await prisma.category.create({
      data: {
        storeId: testStoreId,
        name: `Cat ${Date.now()}`,
      },
    });

    const product = await prisma.product.create({
      data: {
        storeId: testStoreId,
        categoryId: category.id,
        name: `Stock Guard Item ${Date.now()}`,
        cost: 10000,
        sellingPrice: 15000,
        stock: 2,
      },
    });
    testProductId = product.id;

    // 6. Generate auth token
    const { generateAccessToken } = await import('../src/utils/jwt.js');
    authToken = generateAccessToken({
      userId: testUserId,
      storeId: testStoreId,
      roleId: role.id,
      roleName: 'Owner Admin',
      permissions: ['sync_data', 'view_reports', 'create_transaction'],
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.auditLog.deleteMany({ where: { storeId: testStoreId } });
    await prisma.payment.deleteMany({ where: { transaction: { storeId: testStoreId } } });
    await prisma.transactionItem.deleteMany({ where: { transaction: { storeId: testStoreId } } });
    await prisma.transaction.deleteMany({ where: { storeId: testStoreId } });
    await prisma.stockMovement.deleteMany({ where: { storeId: testStoreId } });
    await prisma.product.deleteMany({ where: { storeId: testStoreId } });
    await prisma.category.deleteMany({ where: { storeId: testStoreId } });
    await prisma.user.deleteMany({ where: { storeId: testStoreId } });
    await prisma.rolePermission.deleteMany({ where: { role: { storeId: testStoreId } } });
    await prisma.role.deleteMany({ where: { storeId: testStoreId } });
    await prisma.syncEvent.deleteMany({ where: { storeId: testStoreId } });
    await prisma.syncCursor.deleteMany({ where: { storeId: testStoreId } });
    await prisma.paymentMethod.deleteMany({ where: { storeId: testStoreId } });
    await prisma.store.delete({ where: { id: testStoreId } });
  });

  it('PRO tier store can access subscription info, dashboard summary, and sync', async () => {
    // 1. Subscription info
    const subRes = await request(app)
      .get('/api/v1/subscription')
      .set('Authorization', `Bearer ${authToken}`);
    expect(subRes.status).toBe(200);
    expect(subRes.body.data.plan).toBe('PRO');
    expect(subRes.body.data.entitlements.webDashboard).toBe(true);
    expect(subRes.body.data.entitlements.cloudSync).toBe(true);

    // 2. Dashboard summary
    const dashRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${authToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.store.name).toBeDefined();

    // 3. Sync pull
    const syncRes = await request(app)
      .get('/api/v1/sync/pull?cursor=0&deviceId=dev-test-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(syncRes.status).toBe(200);
  });

  it('FREE tier store is rejected from sync and web dashboard with 403 UPGRADE_REQUIRED', async () => {
    // Downgrade store to FREE
    await request(app)
      .post('/api/v1/subscription/upgrade')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ plan: 'FREE' });

    // Sync should be rejected
    const syncRes = await request(app)
      .get('/api/v1/sync/pull?cursor=0&deviceId=dev-test-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(syncRes.status).toBe(403);
    expect(syncRes.body.error.code).toBe('UPGRADE_REQUIRED');

    // Dashboard summary should be rejected
    const dashRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${authToken}`);
    expect(dashRes.status).toBe(403);
    expect(dashRes.body.error.code).toBe('UPGRADE_REQUIRED');
  });

  it('PAID tier store can sync, but is rejected from PRO web dashboard', async () => {
    // Upgrade store to PAID
    await request(app)
      .post('/api/v1/subscription/upgrade')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ plan: 'PAID' });

    // Sync should be allowed
    const syncRes = await request(app)
      .get('/api/v1/sync/pull?cursor=0&deviceId=dev-test-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(syncRes.status).toBe(200);

    // Dashboard summary should still be rejected (requires PRO)
    const dashRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${authToken}`);
    expect(dashRes.status).toBe(403);
    expect(dashRes.body.error.code).toBe('UPGRADE_REQUIRED');
  });

  it('Stock Guard: Prevents overselling when stock is insufficient (zero negative stock)', async () => {
    // Restore to PRO
    await request(app)
      .post('/api/v1/subscription/upgrade')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ plan: 'PRO' });

    // Current product stock is 2. Attempt to sell 5 units.
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          {
            productId: testProductId,
            quantity: 5, // Demands 5, but stock is 2!
            unitPrice: 15000,
            discountAmount: 0,
            subtotal: 75000,
            total: 75000,
          },
        ],
        payments: [
          {
            paymentMethodId: (await prisma.paymentMethod.findFirst({ where: { storeId: testStoreId } }))?.id ||
              (await prisma.paymentMethod.create({ data: { storeId: testStoreId, name: 'Tunai', type: 'CASH' } })).id,
            amount: 75000,
          },
        ],
        subtotal: 75000,
        discountTotal: 0,
        roundingAmount: 0,
        total: 75000,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

    // Verify stock in database remains exactly 2 (not negative!)
    const p = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(Number(p?.stock)).toBe(2);
  });
});

