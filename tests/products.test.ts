import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Products & Catalog API Tests', () => {
  const app = createApp();
  let token: string;
  let categoryId: string;
  let createdProductId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    token = loginRes.body.data.accessToken;

    const catRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`);
    categoryId = catRes.body.data[0].id;
  });

  it('POST /api/v1/products creates product with variants and initial stock', async () => {
    const sku = `TEST-KOPI-${Date.now()}`;
    const barcode = `899${Date.now()}`;

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        name: `Kopi Susu Aren ${Date.now()}`,
        sku,
        barcode,
        cost: 8000,
        sellingPrice: 18000,
        stock: 50,
        lowStockThreshold: 5,
        variants: [
          {
            name: 'Less Sugar',
            cost: 8000,
            sellingPrice: 18000,
            stock: 25,
            lowStockThreshold: 5,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBeDefined();
    expect(res.body.data.variants.length).toBe(1);

    createdProductId = res.body.data.id;
  });

  it('POST /api/v1/products with duplicate SKU returns 409', async () => {
    const prod = await request(app)
      .get(`/api/v1/products/${createdProductId}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        name: `Produk Duplikat ${Date.now()}`,
        sku: prod.body.data.sku,
        cost: 5000,
        sellingPrice: 10000,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_SKU');
  });

  it('GET /api/v1/products?search=... searches by product name or SKU', async () => {
    const res = await request(app)
      .get('/api/v1/products?search=Kopi')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('PATCH /api/v1/products/:id updates price and stock', async () => {
    const res = await request(app)
      .patch(`/api/v1/products/${createdProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sellingPrice: 20000,
        cost: 9000,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.sellingPrice)).toBe(20000);
    expect(Number(res.body.data.cost)).toBe(9000);
  });
});
