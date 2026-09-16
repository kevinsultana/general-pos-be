import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { v4 as uuidv4 } from 'uuid';

describe('Transactions & Financial Integrity Tests', () => {
  const app = createApp();
  let token: string;
  let productId: string;
  let paymentMethodId: string;
  let initialStock: number;
  let completedTrxId: string;

  beforeAll(async () => {
    // Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    token = loginRes.body.data.accessToken;

    // Get payment method (Cash)
    const pmRes = await request(app)
      .get('/api/v1/payment-methods')
      .set('Authorization', `Bearer ${token}`);
    paymentMethodId = pmRes.body.data[0].id;

    // Get Category
    const catRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`);
    const catId = catRes.body.data[0].id;

    // Create a fresh test product with 100 units stock
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: catId,
        name: `Teh Botol Kotak ${Date.now()}`,
        cost: 3000,
        sellingPrice: 5000,
        stock: 100,
        lowStockThreshold: 10,
      });

    productId = prodRes.body.data.id;
    initialStock = 100;
  });

  it('POST /api/v1/transactions completes transaction atomically and deducts stock', async () => {
    const trxId = uuidv4();
    const qtyToBuy = 5;

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: trxId,
        subtotal: 25000,
        total: 25000,
        items: [
          {
            productId,
            quantity: qtyToBuy,
            unitPrice: 5000,
            subtotal: 25000,
            total: 25000,
          },
        ],
        payments: [
          {
            paymentMethodId,
            amount: 25000,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(trxId);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.items.length).toBe(1);
    expect(Number(res.body.data.items[0].unitCostSnapshot)).toBe(3000); // Historical Cost snapshot

    completedTrxId = trxId;

    // Verify stock is deducted: 100 - 5 = 95
    const prodCheck = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(Number(prodCheck.body.data.stock)).toBe(initialStock - qtyToBuy);
  });

  it('Idempotency: Re-submitting the same transaction ID returns existing transaction without duplicate deduction', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: completedTrxId,
        subtotal: 25000,
        total: 25000,
        items: [
          {
            productId,
            quantity: 5,
            unitPrice: 5000,
            subtotal: 25000,
            total: 25000,
          },
        ],
        payments: [
          {
            paymentMethodId,
            amount: 25000,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(completedTrxId);

    // Stock must STILL be 95 (NOT deducted again to 90!)
    const prodCheck = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(Number(prodCheck.body.data.stock)).toBe(95);
  });

  it('POST /api/v1/transactions/:id/cancel cancels transaction and reverses stock', async () => {
    const res = await request(app)
      .post(`/api/v1/transactions/${completedTrxId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Pelanggan membatalkan pesanan' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CANCELLED');

    // Stock must be restored back to 100 units
    const prodCheck = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(Number(prodCheck.body.data.stock)).toBe(initialStock);
  });

  it('POST /api/v1/transactions/:id/refunds processes refund and restores stock', async () => {
    // 1. Create another transaction to refund
    const newTrxId = uuidv4();
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: newTrxId,
        subtotal: 15000,
        total: 15000,
        items: [
          {
            productId,
            quantity: 3,
            unitPrice: 5000,
            subtotal: 15000,
            total: 15000,
          },
        ],
        payments: [
          {
            paymentMethodId,
            amount: 15000,
          },
        ],
      });

    const trxItem = createRes.body.data.items[0];

    // Stock is now 100 - 3 = 97
    // 2. Perform Refund of 2 items
    const refundRes = await request(app)
      .post(`/api/v1/transactions/${newTrxId}/refunds`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        reason: 'Barang rusak / cacat',
        items: [
          {
            transactionItemId: trxItem.id,
            quantity: 2,
            amount: 10000,
          },
        ],
      });

    expect(refundRes.status).toBe(201);
    expect(refundRes.body.success).toBe(true);

    // Stock should be restored by 2: 97 + 2 = 99
    const prodCheck = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(Number(prodCheck.body.data.stock)).toBe(99);
  });

  // ──────────────── PRD Bab 21 & INV-013: Cash Rounding Tests ────────────────

  it('PRD Bab 21: Rejects non-CASH payment with non-zero roundingAmount', async () => {
    // Get QRIS payment method
    const pmRes = await request(app)
      .get('/api/v1/payment-methods')
      .set('Authorization', `Bearer ${token}`);
    const qrisPm = pmRes.body.data.find((pm: any) => pm.type !== 'CASH') || pmRes.body.data[1];

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: uuidv4(),
        subtotal: 10000,
        roundingAmount: 200,
        total: 10200,
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 10000,
            subtotal: 10000,
            total: 10000,
          },
        ],
        payments: [
          {
            paymentMethodId: qrisPm.id,
            amount: 10200,
            roundingAmount: 200, // ILLEGAL: QRIS must not have rounding
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_ROUNDING_AMOUNT');
  });

  it('PRD Bab 21: Rejects transaction when Transaction.roundingAmount does not match sum of payments rounding', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: uuidv4(),
        subtotal: 10000,
        roundingAmount: 500, // Mismatched rounding
        total: 10500,
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 10000,
            subtotal: 10000,
            total: 10000,
          },
        ],
        payments: [
          {
            paymentMethodId,
            amount: 10200,
            roundingAmount: 200,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_ROUNDING_AMOUNT');
  });

  it('PRD Bab 21: Successfully completes transaction with CASH payment and valid roundingAmount', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: uuidv4(),
        subtotal: 9800,
        roundingAmount: 200,
        total: 10000,
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 9800,
            subtotal: 9800,
            total: 9800,
          },
        ],
        payments: [
          {
            paymentMethodId, // CASH
            amount: 9800,
            roundingAmount: 200,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.roundingAmount)).toBe(200);
    expect(Number(res.body.data.total)).toBe(10000);
  });

  it('P4.2: Completes transactions with DELIVERY and ONLINE order types successfully', async () => {
    // 1. Test DELIVERY orderType
    const deliveryRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: uuidv4(),
        orderType: 'DELIVERY',
        subtotal: 10000,
        total: 10000,
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 10000,
            subtotal: 10000,
            total: 10000,
          },
        ],
        payments: [
          {
            paymentMethodId,
            amount: 10000,
          },
        ],
      });

    expect(deliveryRes.status).toBe(201);
    expect(deliveryRes.body.success).toBe(true);
    expect(deliveryRes.body.data.orderType).toBe('DELIVERY');

    // 2. Test ONLINE orderType
    const onlineRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: uuidv4(),
        orderType: 'ONLINE',
        subtotal: 10000,
        total: 10000,
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 10000,
            subtotal: 10000,
            total: 10000,
          },
        ],
        payments: [
          {
            paymentMethodId,
            amount: 10000,
          },
        ],
      });

    expect(onlineRes.status).toBe(201);
    expect(onlineRes.body.success).toBe(true);
    expect(onlineRes.body.data.orderType).toBe('ONLINE');
  });
});
