import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Entitlement Middleware Protection', () => {
  const app = createApp();
  const freeUsername = `free_gate_${Date.now()}`;
  let freeToken = '';

  afterAll(async () => {
    try {
      const u = await prisma.user.findFirst({ where: { username: freeUsername } });
      if (u) {
        await prisma.rolePermission.deleteMany({ where: { role: { storeId: u.storeId } } });
        await prisma.user.deleteMany({ where: { storeId: u.storeId } });
        await prisma.role.deleteMany({ where: { storeId: u.storeId } });
        await prisma.paymentMethod.deleteMany({ where: { storeId: u.storeId } });
        await prisma.category.deleteMany({ where: { storeId: u.storeId } });
        await prisma.auditLog.deleteMany({ where: { storeId: u.storeId } });
        await prisma.store.deleteMany({ where: { id: u.storeId } });
      }
    } catch (_) {}
  });

  it('setup: registers a FREE user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register-store')
      .send({
        storeName: 'Toko Gating Free',
        username: freeUsername,
        password: 'password123',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.store.subscriptionPlan).toBe('FREE');
    freeToken = res.body.data.accessToken;
  });

  it('rejects GET /api/v1/products with 403 SUBSCRIPTION_REQUIRED for FREE tier', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${freeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('rejects POST /api/v1/sync/push with 403 SUBSCRIPTION_REQUIRED for FREE tier', async () => {
    const res = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({ events: [] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('rejects GET /api/v1/reports/sales with 403 SUBSCRIPTION_REQUIRED for FREE tier', async () => {
    const res = await request(app)
      .get('/api/v1/reports/sales')
      .set('Authorization', `Bearer ${freeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
  });
});
