import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Auth Module API Tests', () => {
  const app = createApp();
  let validAccessToken: string;
  let validRefreshToken: string;

  it('POST /api/v1/auth/login with valid credentials returns 200 and tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'owner',
        password: 'owner123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.username).toBe('owner');
    expect(res.body.data.user.role.name).toBe('Owner');
    expect(res.body.data.permissions.length).toBeGreaterThan(0);

    validAccessToken = res.body.data.accessToken;
    validRefreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/auth/login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'owner',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/v1/auth/login with non-existent user returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'nonexistentuser',
        password: 'somepassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /api/v1/auth/me without token returns 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/auth/me with valid Bearer token returns 200 and user profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('owner');
    expect(res.body.data.store).toBeDefined();
  });

  it('POST /api/v1/auth/refresh with valid refresh token returns 200 and new tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: validRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('POST /api/v1/auth/refresh with invalid token returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'invalid.token.signature' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
