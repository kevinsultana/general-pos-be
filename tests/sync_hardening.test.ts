import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 11 — Cloud POS Hardening: Sync Engine, Idempotency & Security Tests', () => {
  const app = createApp();
  let token: string;
  let storeId: string;
  let productId: string;
  let paymentMethodId: string;
  const initialStock = 50;

  beforeAll(async () => {
    // 1. Login as owner
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.accessToken;
    storeId = loginRes.body.data.user.storeId;

    // Clean up any lingering sync events for store to avoid pagination issues
    await prisma.syncEvent.deleteMany({ where: { storeId } });

    // 3. Get Payment Method
    const pmRes = await request(app)
      .get('/api/v1/payment-methods')
      .set('Authorization', `Bearer ${token}`);
    paymentMethodId = pmRes.body.data[0].id;

    // 4. Get Category
    const catRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`);
    const catId = catRes.body.data[0].id;

    // 5. Create fresh product for testing
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: catId,
        name: `Sync Hardening Item ${Date.now()}`,
        cost: 10000,
        sellingPrice: 15000,
        stock: initialStock,
        lowStockThreshold: 5,
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;
  });

  // ──────────────── 1. Idempotent Push ────────────────

  it('Sync Push: First delivery completes transaction and deducts stock', async () => {
    const eventId = uuidv4();
    const trxId = uuidv4();
    const deviceId = `pos-device-${Date.now()}`;
    const qtyToBuy = 4;

    const pushPayload = {
      events: [
        {
          eventId,
          deviceId,
          occurredAt: new Date().toISOString(),
          operation: 'COMPLETE_TRANSACTION',
          entityId: trxId,
          payload: {
            id: trxId,
            subtotal: 60000,
            discountTotal: 0,
            roundingAmount: 0,
            total: 60000,
            items: [
              {
                productId,
                quantity: qtyToBuy,
                unitPrice: 15000,
                discountAmount: 0,
                subtotal: 60000,
                total: 60000,
              },
            ],
            payments: [
              {
                paymentMethodId,
                amount: 60000,
                roundingAmount: 0,
                paymentType: 'CASH',
                tenderedAmount: 100000,
                changeAmount: 40000,
              },
            ],
          },
          clientVersion: '1.0.0',
        },
      ],
    };

    const res1 = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send(pushPayload);

    expect(res1.status).toBe(200);
    expect(res1.body.data.received).toBe(1);
    expect(res1.body.data.synced).toBe(1);
    expect(res1.body.data.results[0].status).toBe('SYNCED');

    // Verify stock was reduced by 4
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(Number(prodRes.body.data.stock)).toBe(initialStock - qtyToBuy);

    // ── IDEMPOTENCY TEST: Push the EXACT SAME event again ──
    const res2 = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send(pushPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.data.synced).toBe(0);
    expect(res2.body.data.skipped).toBe(1);
    expect(res2.body.data.results[0].status).toBe('SKIPPED');

    // Verify stock was NOT deducted again (still initialStock - 4)
    const prodRes2 = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(Number(prodRes2.body.data.stock)).toBe(initialStock - qtyToBuy);
  });

  // ──────────────── 2. Multi-Device Cursor Pull ────────────────

  it('Sync Pull: Device B receives events from Device A, but Device A does not receive its own events', async () => {
    const eventId = uuidv4();
    const trxId = uuidv4();
    const deviceA = `device-alpha-${Date.now()}`;
    const deviceB = `device-beta-${Date.now()}`;

    // Device A pushes an event
    await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceA)
      .send({
        events: [
          {
            eventId,
            deviceId: deviceA,
            occurredAt: new Date().toISOString(),
            operation: 'ADJUST_STOCK',
            entityId: eventId,
            payload: {
              productId,
              quantityDelta: 10,
              reason: 'Received restock from supplier',
              type: 'ADJUSTMENT',
            },
            clientVersion: '1.0.0',
          },
        ],
      });

    // Device B pulls: should receive Device A's event
    const pullB = await request(app)
      .get('/api/v1/sync/pull?cursor=0')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceB);

    expect(pullB.status).toBe(200);
    expect(pullB.body.data.events).toBeDefined();
    const foundInB = pullB.body.data.events.some((e: any) => e.deviceId === deviceA);
    expect(foundInB).toBe(true);

    // Device A pulls: should NOT receive its own event
    const pullA = await request(app)
      .get('/api/v1/sync/pull?cursor=0')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceA);

    expect(pullA.status).toBe(200);
    const foundInA = pullA.body.data.events.some((e: any) => e.deviceId === deviceA);
    expect(foundInA).toBe(false);

    // Pulling again with nextCursor should yield no more events
    const nextCursor = pullB.body.data.nextCursor;
    const pullBNext = await request(app)
      .get(`/api/v1/sync/pull?cursor=${nextCursor}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceB);
    expect(pullBNext.body.data.events.length).toBe(0);
  });

  // ──────────────── 3. Security & RBAC ────────────────

  it('Sync Security: Rejects unauthorized requests without token', async () => {
    const res = await request(app)
      .post('/api/v1/sync/push')
      .send({ events: [] });
    expect(res.status).toBe(401);
  });

  it('Sync Security: Rejects invalid JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', 'Bearer invalid-token-xyz')
      .send({ events: [] });
    expect(res.status).toBe(401);
  });

  // ──────────────── 4. Data Immutability & Reversal ────────────────

  it('Sync Integrity: CANCEL_TRANSACTION reverses stock and updates status', async () => {
    const eventId = uuidv4();
    const trxId = uuidv4();
    const deviceId = `pos-cancel-${Date.now()}`;
    const qty = 3;

    // 1. Complete transaction first
    await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'COMPLETE_TRANSACTION',
            entityId: trxId,
            payload: {
              id: trxId,
              subtotal: 45000,
              discountTotal: 0,
              roundingAmount: 0,
              total: 45000,
              items: [
                {
                  productId,
                  quantity: qty,
                  unitPrice: 15000,
                  discountAmount: 0,
                  subtotal: 45000,
                  total: 45000,
                },
              ],
              payments: [
                {
                  paymentMethodId,
                  amount: 45000,
                  roundingAmount: 0,
                  paymentType: 'CASH',
                  tenderedAmount: 50000,
                  changeAmount: 5000,
                },
              ],
            },
            clientVersion: '1.0.0',
          },
        ],
      });

    // Check stock after sale
    const stockAfterSale = (
      await request(app).get(`/api/v1/products/${productId}`).set('Authorization', `Bearer ${token}`)
    ).body.data.stock;

    // 2. Push CANCEL_TRANSACTION event
    const cancelEventId = uuidv4();
    const cancelRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: cancelEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'CANCEL_TRANSACTION',
            entityId: trxId,
            payload: {
              transactionId: trxId,
              reason: 'Customer changed mind before leaving store',
            },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.synced).toBe(1);

    // Verify stock is restored
    const stockAfterCancel = (
      await request(app).get(`/api/v1/products/${productId}`).set('Authorization', `Bearer ${token}`)
    ).body.data.stock;
    expect(Number(stockAfterCancel)).toBe(Number(stockAfterSale) + qty);

    // Verify transaction status is CANCELLED
    const trxRes = await request(app)
      .get(`/api/v1/transactions/${trxId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(trxRes.body.data.status).toBe('CANCELLED');
  });
});
