import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Audit Log API Tests', () => {
  const app = createApp();
  let token: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    token = loginRes.body.data.accessToken;
  });

  it('GET /api/v1/audit-logs returns recorded system activities', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const first = res.body.data[0];
    expect(first.action).toBeDefined();
    expect(first.entityType).toBeDefined();
    expect(first.createdAt).toBeDefined();
  });
});
