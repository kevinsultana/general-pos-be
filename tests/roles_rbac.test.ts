import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Roles & RBAC Authorization Tests', () => {
  const app = createApp();
  let ownerToken: string;
  let cashierToken: string;
  let createdRoleId: string;

  beforeAll(async () => {
    // 1. Login as Owner
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    ownerToken = ownerRes.body.data.accessToken;

    // 2. Find Cashier role
    const rolesRes = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerToken}`);
    const cashierRole = rolesRes.body.data.find((r: any) => r.name === 'Cashier');

    // 3. Create or login as a test Cashier user
    const username = `cashier_test_${Date.now()}`;
    await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        username,
        password: 'password123',
        displayName: 'Test Cashier User',
        roleId: cashierRole.id,
      });

    const cashierLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username, password: 'password123' });
    cashierToken = cashierLoginRes.body.data.accessToken;
  });

  it('GET /api/v1/roles/permissions returns all system permissions', async () => {
    const res = await request(app)
      .get('/api/v1/roles/permissions')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(15);
  });

  it('Cashier cannot access manage_roles endpoint (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Owner can create custom role with specific permissions', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Barista_${Date.now()}`,
        description: 'Staf Barista untuk melihat pesanan',
        permissions: ['view_products', 'view_sales'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isSystem).toBe(false);
    expect(res.body.data.permissions).toContain('view_products');
    expect(res.body.data.permissions).toContain('view_sales');

    createdRoleId = res.body.data.id;
  });

  it('Owner cannot delete a system role (returns 400)', async () => {
    const rolesRes = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerToken}`);

    const systemRole = rolesRes.body.data.find((r: any) => r.isSystem);

    const res = await request(app)
      .delete(`/api/v1/roles/${systemRole.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CANNOT_DELETE_SYSTEM_ROLE');
  });

  it('Owner can delete a custom role', async () => {
    const res = await request(app)
      .delete(`/api/v1/roles/${createdRoleId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
