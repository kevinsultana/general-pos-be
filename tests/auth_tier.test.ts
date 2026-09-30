import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Auth Subscription Tier & Payload', () => {
  const app = createApp();
  const testUsername = `user_free_${Date.now()}`;
  let registeredToken: string = '';

  afterAll(async () => {
    try {
      const u = await prisma.user.findFirst({ where: { username: testUsername } });
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

  it('POST /api/v1/auth/register-store creates store with FREE tier', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register-store')
      .send({
        storeName: 'Toko Test Free',
        username: testUsername,
        password: 'password123',
        ownerName: 'Owner Free',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.store.subscriptionPlan).toBe('FREE');
    expect(res.body.data.user.tier).toBe('FREE');
    expect(res.body.data.user.canCloudSync).toBe(false);
    expect(res.body.data.user.stores).toBeDefined();
    expect(res.body.data.user.stores[0].id).toBe(res.body.data.store.id);
    expect(res.body.data.user.stores[0].tier).toBe('FREE');
    registeredToken = res.body.data.accessToken;
  });

  it('POST /api/v1/auth/login returns tier, stores, and canCloudSync', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: testUsername,
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.tier).toBe('FREE');
    expect(res.body.data.user.canCloudSync).toBe(false);
    expect(res.body.data.user.stores).toBeDefined();
    expect(res.body.data.user.stores[0].tier).toBe('FREE');
    expect(res.body.data.store.subscriptionPlan).toBe('FREE');
  });

  it('GET /api/v1/auth/me returns tier, stores, and canCloudSync', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registeredToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.tier).toBe('FREE');
    expect(res.body.data.user.canCloudSync).toBe(false);
    expect(res.body.data.user.stores[0].tier).toBe('FREE');
  });

  it('POST /api/v1/auth/register alias works identically', async () => {
    const aliasUser = `alias_free_${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        storeName: 'Toko Alias Free',
        username: aliasUser,
        password: 'password123',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.store.subscriptionPlan).toBe('FREE');

    // Clean up
    const u = await prisma.user.findFirst({ where: { username: aliasUser } });
    if (u) {
      await prisma.rolePermission.deleteMany({ where: { role: { storeId: u.storeId } } });
      await prisma.user.deleteMany({ where: { storeId: u.storeId } });
      await prisma.role.deleteMany({ where: { storeId: u.storeId } });
      await prisma.paymentMethod.deleteMany({ where: { storeId: u.storeId } });
      await prisma.category.deleteMany({ where: { storeId: u.storeId } });
      await prisma.auditLog.deleteMany({ where: { storeId: u.storeId } });
      await prisma.store.deleteMany({ where: { id: u.storeId } });
    }
  });
});
