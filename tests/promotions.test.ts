import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Promotions & minimumPurchase / minSpend Scale Tests', () => {
  const app = createApp();
  let token: string;
  let promoId1: string;
  let promoId2: string;
  const uniqueSuffix = Date.now();

  beforeAll(async () => {
    // Login as owner (has manage_promotions, view_promotions, create_transaction permissions)
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.accessToken;
  });

  it('POST /api/v1/promotions creates promotion with standard minimumPurchase and FIXED_AMOUNT', async () => {
    const res = await request(app)
      .post('/api/v1/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Promo Standar ${uniqueSuffix}`,
        type: 'FIXED_AMOUNT',
        value: 10000,
        minimumPurchase: 50000, // 1:1 scale IDR whole Rupiah
        code: `PROMO50_${uniqueSuffix}`,
        startAt: new Date(Date.now() - 3600000).toISOString(),
        endAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(`Promo Standar ${uniqueSuffix}`);
    expect(res.body.data.type).toBe('FIXED_AMOUNT');
    expect(res.body.data.value).toBe(10000);
    expect(res.body.data.minimumPurchase).toBe(50000);
    // Alias checks
    expect(res.body.data.discountType).toBe('FIXED_AMOUNT');
    expect(res.body.data.discountValue).toBe(10000);
    expect(res.body.data.minSpend).toBe(50000);

    promoId1 = res.body.data.id;
  });

  it('POST /api/v1/promotions creates promotion with alias fields (minSpend, FIXED, discountValue)', async () => {
    const res = await request(app)
      .post('/api/v1/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Promo Alias ${uniqueSuffix}`,
        discountType: 'FIXED', // legacy FIXED should normalize to FIXED_AMOUNT
        discountValue: 5000,
        minSpend: 25000, // alias for minimumPurchase
        code: `ALIAS25_${uniqueSuffix}`,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('FIXED_AMOUNT');
    expect(res.body.data.value).toBe(5000);
    expect(res.body.data.minimumPurchase).toBe(25000);
    expect(res.body.data.discountType).toBe('FIXED_AMOUNT');
    expect(res.body.data.minSpend).toBe(25000);

    promoId2 = res.body.data.id;
  });

  it('GET /api/v1/promotions returns list formatted with both Prisma fields and aliases', async () => {
    const res = await request(app)
      .get('/api/v1/promotions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const found = res.body.data.find((p: any) => p.id === promoId1);
    expect(found).toBeDefined();
    expect(found.minimumPurchase).toBe(50000);
    expect(found.minSpend).toBe(50000);
    expect(found.type).toBe('FIXED_AMOUNT');
    expect(found.discountType).toBe('FIXED_AMOUNT');
  });

  it('POST /api/v1/promotions/validate enforces 1:1 minimumPurchase requirement', async () => {
    // 1. Below minimumPurchase (30.000 < 50.000) -> invalid
    const failRes = await request(app)
      .post('/api/v1/promotions/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: `PROMO50_${uniqueSuffix}`,
        subtotal: 30000,
      });

    expect(failRes.status).toBe(200);
    expect(failRes.body.data.valid).toBe(false);
    expect(failRes.body.data.message).toContain('Minimal belanja');

    // 2. Meets minimumPurchase (50.000 >= 50.000) -> valid
    const passRes = await request(app)
      .post('/api/v1/promotions/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: `PROMO50_${uniqueSuffix}`,
        subtotal: 50000,
      });

    expect(passRes.status).toBe(200);
    expect(passRes.body.data.valid).toBe(true);
    expect(passRes.body.data.discountAmount).toBe(10000);
  });

  it('PUT /api/v1/promotions/:id works as route alias for update', async () => {
    const res = await request(app)
      .put(`/api/v1/promotions/${promoId1}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        active: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.active).toBe(false);
  });
});
