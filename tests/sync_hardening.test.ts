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
  let catId: string;
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
    catId = catRes.body.data[0].id;

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

  // ──────────────── 6. Sync Push: Product CRUD ────────────────

  it('Sync Push: CREATE_PRODUCT, UPDATE_PRODUCT, and DELETE_PRODUCT', async () => {
    const deviceId = `pos-device-${Date.now()}`;
    const newProdId = uuidv4();

    // 1. CREATE_PRODUCT
    const createProdEventId = uuidv4();
    const createProdRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: createProdEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'CREATE_PRODUCT',
            entityId: newProdId,
            payload: {
              categoryId: catId,
              name: `Sync Product ${Date.now()}`,
              cost: 5000,
              sellingPrice: 8000,
              stock: 20,
              lowStockThreshold: 2,
            },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(createProdRes.status).toBe(200);
    expect(createProdRes.body.data.synced).toBe(1);

    // Find created product in DB
    const dbProd = await prisma.product.findFirst({
      where: { storeId, name: { startsWith: 'Sync Product' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(dbProd).toBeDefined();
    expect(Number(dbProd?.sellingPrice)).toBe(8000);
    const createdProdId = dbProd!.id;

    // 2. UPDATE_PRODUCT
    const updateProdEventId = uuidv4();
    const updateProdRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: updateProdEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'UPDATE_PRODUCT',
            entityId: createdProdId,
            payload: {
              sellingPrice: 9500,
            },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(updateProdRes.status).toBe(200);
    expect(updateProdRes.body.data.synced).toBe(1);

    const updatedProd = await prisma.product.findUnique({ where: { id: createdProdId } });
    expect(Number(updatedProd?.sellingPrice)).toBe(9500);

    // 3. DELETE_PRODUCT
    const deleteProdEventId = uuidv4();
    const deleteProdRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: deleteProdEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'DELETE_PRODUCT',
            entityId: createdProdId,
            payload: { id: createdProdId },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(deleteProdRes.status).toBe(200);
    expect(deleteProdRes.body.data.synced).toBe(1);

    const deletedProd = await prisma.product.findUnique({ where: { id: createdProdId } });
    expect(deletedProd === null || deletedProd.active === false).toBe(true);
  });

  // ──────────────── 7. Sync Push: Customer CRUD ────────────────

  it('Sync Push: CREATE_CUSTOMER, UPDATE_CUSTOMER, and DELETE_CUSTOMER', async () => {
    const deviceId = `pos-device-${Date.now()}`;
    const custEventId = uuidv4();
    const custName = `Customer ${Date.now()}`;

    // 1. CREATE_CUSTOMER
    const createCustRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: custEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'CREATE_CUSTOMER',
            entityId: uuidv4(),
            payload: {
              name: custName,
              phone: '08123456789',
              notes: 'Sync VIP',
            },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(createCustRes.status).toBe(200);
    expect(createCustRes.body.data.synced).toBe(1);

    const dbCust = await prisma.customer.findFirst({
      where: { storeId, name: custName },
    });
    expect(dbCust).toBeDefined();
    expect(dbCust?.phone).toBe('08123456789');
    const custId = dbCust!.id;

    // 2. UPDATE_CUSTOMER
    const updateCustEventId = uuidv4();
    const updateCustRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: updateCustEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'UPDATE_CUSTOMER',
            entityId: custId,
            payload: {
              notes: 'Sync VIP Platinum',
            },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(updateCustRes.status).toBe(200);
    expect(updateCustRes.body.data.synced).toBe(1);

    const updatedCust = await prisma.customer.findUnique({ where: { id: custId } });
    expect(updatedCust?.notes).toBe('Sync VIP Platinum');

    // 3. DELETE_CUSTOMER
    const deleteCustEventId = uuidv4();
    const deleteCustRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: deleteCustEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'DELETE_CUSTOMER',
            entityId: custId,
            payload: { id: custId },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(deleteCustRes.status).toBe(200);
    expect(deleteCustRes.body.data.synced).toBe(1);

    const deletedCust = await prisma.customer.findUnique({ where: { id: custId } });
    expect(deletedCust).toBeNull();
  });

  // ──────────────── 8. Sync Push: Promotion CRUD ────────────────

  it('Sync Push: CREATE_PROMOTION, UPDATE_PROMOTION, and DELETE_PROMOTION', async () => {
    const deviceId = `pos-device-${Date.now()}`;
    const promoEventId = uuidv4();
    const promoName = `Promo Sync ${Date.now()}`;

    // 1. CREATE_PROMOTION
    const createPromoRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: promoEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'CREATE_PROMOTION',
            entityId: uuidv4(),
            payload: {
              name: promoName,
              type: 'PERCENTAGE',
              value: 15,
              startAt: new Date().toISOString(),
              endAt: new Date(Date.now() + 86400000 * 7).toISOString(),
              minimumPurchase: 50000,
              code: `SYNC${Date.now()}`.slice(0, 15),
            },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(createPromoRes.status).toBe(200);
    expect(createPromoRes.body.data.synced).toBe(1);

    const dbPromo = await prisma.promotion.findFirst({
      where: { storeId, name: promoName },
      include: { codes: true },
    });
    expect(dbPromo).toBeDefined();
    expect(Number(dbPromo?.value)).toBe(15);
    const promoId = dbPromo!.id;

    // 2. UPDATE_PROMOTION
    const updatePromoEventId = uuidv4();
    const updatePromoRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: updatePromoEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'UPDATE_PROMOTION',
            entityId: promoId,
            payload: {
              value: 20,
            },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(updatePromoRes.status).toBe(200);
    expect(updatePromoRes.body.data.synced).toBe(1);

    const updatedPromo = await prisma.promotion.findUnique({ where: { id: promoId } });
    expect(Number(updatedPromo?.value)).toBe(20);

    // 3. DELETE_PROMOTION
    const deletePromoEventId = uuidv4();
    const deletePromoRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: deletePromoEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'DELETE_PROMOTION',
            entityId: promoId,
            payload: { id: promoId },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(deletePromoRes.status).toBe(200);
    expect(deletePromoRes.body.data.synced).toBe(1);

    const deletedPromo = await prisma.promotion.findUnique({ where: { id: promoId } });
    expect(deletedPromo).toBeNull();
  });

  // ──────────────── P3.2: Conflict & Error Handling Lifecycle ────────────────

  it('P3.2: Failed or conflicting events are recorded with proper status and can be retried', async () => {
    const deviceId = `pos-device-${Date.now()}`;
    const failedEventId = uuidv4();
    const nonExistentPromoId = uuidv4();

    // 1. Push an event that triggers an error (updating nonexistent promotion)
    const pushRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: failedEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'UPDATE_PROMOTION',
            entityId: nonExistentPromoId,
            payload: { value: 25 },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(pushRes.status).toBe(200);
    expect(pushRes.body.data.failed).toBe(1);
    expect(pushRes.body.data.results[0].status).toBe('FAILED');

    // Verify record in database is marked FAILED
    const failedRecord = await prisma.syncEvent.findUnique({ where: { id: failedEventId } });
    expect(failedRecord).toBeDefined();
    expect(failedRecord?.status).toBe('FAILED');

    // 2. Client retries the event with the same eventId after correcting payload
    // First create the actual promo so update succeeds
    const createPromoRes = await request(app)
      .post('/api/v1/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Retry Promo ${Date.now()}`,
        type: 'PERCENTAGE',
        value: 10,
      });
    const validPromoId = createPromoRes.body.data.id;

    // Push retry with same eventId but targeting the valid promo
    const retryRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', deviceId)
      .send({
        events: [
          {
            eventId: failedEventId,
            deviceId,
            occurredAt: new Date().toISOString(),
            operation: 'UPDATE_PROMOTION',
            entityId: validPromoId,
            payload: { value: 30 },
            clientVersion: '1.0.0',
          },
        ],
      });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.synced).toBe(1);
    expect(retryRes.body.data.results[0].status).toBe('SYNCED');

    // Verify record in database is now updated to SYNCED
    const retriedRecord = await prisma.syncEvent.findUnique({ where: { id: failedEventId } });
    expect(retriedRecord?.status).toBe('SYNCED');
  });

  it('P3.5: GET /sync/status returns device count, event statistics, and recent sync history', async () => {
    const res = await request(app)
      .get('/api/v1/sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalEvents');
    expect(res.body.data).toHaveProperty('deviceCount');
    expect(res.body.data).toHaveProperty('devices');
    expect(res.body.data).toHaveProperty('recentEvents');
    expect(Array.isArray(res.body.data.devices)).toBe(true);
    expect(Array.isArray(res.body.data.recentEvents)).toBe(true);
    expect(res.body.data.totalEvents).toBeGreaterThanOrEqual(1);
  });

  it('Phase 1 Blocker Test: Mobile push with paymentMethodId pm-cash and local ISO timestamp without Z succeeds', async () => {
    const mobileEventId = uuidv4();
    const mobileTrxId = uuidv4();

    const pushPayload = {
      events: [
        {
          eventId: mobileEventId,
          deviceId: 'mobile-tablet-pos-01',
          occurredAt: '2026-09-16T18:30:00.123456', // No 'Z' suffix (local Dart DateTime format)
          operation: 'COMPLETE_TRANSACTION',
          entityId: mobileTrxId,
          payload: {
            id: mobileTrxId,
            subtotal: 15000,
            discountTotal: 0,
            roundingAmount: 0,
            total: 15000,
            items: [
              {
                productId,
                quantity: 1,
                unitPrice: 15000,
                discountAmount: 0,
                subtotal: 15000,
                total: 15000,
              },
            ],
            payments: [
              {
                paymentMethodId: 'pm-cash', // Mobile client alias!
                amount: 15000,
                roundingAmount: 0,
                paymentType: 'CASH',
              },
            ],
          },
          clientVersion: '1.0.0',
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', 'mobile-tablet-pos-01')
      .send(pushPayload);

    expect(res.status).toBe(200);
    expect(res.body.data.synced).toBe(1);
    expect(res.body.data.results[0].status).toBe('SYNCED');

    // Verify transaction exists in database and paymentMethodId was resolved to a valid store PaymentMethod UUID
    const trx = await prisma.transaction.findUnique({
      where: { id: mobileTrxId },
      include: { payments: { include: { paymentMethod: true } } },
    });
    expect(trx).not.toBeNull();
    expect(trx?.payments.length).toBe(1);
    expect(trx?.payments[0].paymentMethod.type).toBe('CASH');
  });

  it('Phase 3 Resilience Test: Offline COMPLETE_TRANSACTION sync succeeds even when cloud stock is 0 (negative stock allowed)', async () => {
    // 1. Create a product with 0 stock
    const zeroStockProd = await prisma.product.create({
      data: {
        storeId,
        categoryId: catId,
        name: `Zero Stock Item ${Date.now()}`,
        cost: 10000,
        sellingPrice: 15000,
        stock: 0,
      },
    });

    const mobileTrxId = uuidv4();
    const eventId = uuidv4();
    const pushPayload = {
      events: [
        {
          eventId,
          deviceId: 'mobile-offline-tablet',
          occurredAt: new Date().toISOString(),
          operation: 'COMPLETE_TRANSACTION',
          entityId: mobileTrxId,
          payload: {
            id: mobileTrxId,
            transactionNumber: `TRX-OFFLINE-${Date.now()}`,
            subtotal: 30000,
            discountTotal: 0,
            roundingAmount: 0,
            total: 30000,
            items: [
              {
                productId: zeroStockProd.id,
                quantity: 2,
                unitPrice: 15000,
                discountAmount: 0,
                subtotal: 30000,
                total: 30000,
              },
            ],
            payments: [
              {
                paymentMethodId: 'pm-cash',
                amount: 30000,
                roundingAmount: 0,
                paymentType: 'CASH',
              },
            ],
          },
          clientVersion: '1.0.0',
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', 'mobile-offline-tablet')
      .send(pushPayload);

    expect(res.status).toBe(200);
    expect(res.body.data.synced).toBe(1);
    expect(res.body.data.results[0].status).toBe('SYNCED');

    // Verify stock is decremented to -2 and transaction was recorded
    const updatedProd = await prisma.product.findUnique({
      where: { id: zeroStockProd.id },
      select: { stock: true },
    });
    expect(Number(updatedProd?.stock)).toBe(-2);
  });
});

