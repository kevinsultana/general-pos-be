import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Printers & Role/PaperSize Enum Tests', () => {
  const app = createApp();
  let token: string;
  let printerBothId: string;

  beforeAll(async () => {
    // Login as owner (has manage_printers permission)
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.accessToken;
  });

  it('POST /api/v1/printers creates printer with role=BOTH and paperSize=PAPER_80MM', async () => {
    const res = await request(app)
      .post('/api/v1/printers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Dual Kasir & Dapur ${Date.now()}`,
        connectionType: 'BLUETOOTH',
        addressReference: '00:11:22:33:44:55',
        role: 'BOTH',
        paperSize: 'PAPER_80MM',
        receiptCopies: 1,
        kitchenCopies: 2,
        autoPrint: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('BOTH');
    expect(res.body.data.paperSize).toBe('PAPER_80MM');
    expect(res.body.data.connectionType).toBe('BLUETOOTH');
    expect(res.body.data.kitchenCopies).toBe(2);

    printerBothId = res.body.data.id;
  });

  it('POST /api/v1/printers creates printer with role=RECEIPT and paperSize=PAPER_58MM', async () => {
    const res = await request(app)
      .post('/api/v1/printers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Thermal Struk Kasir ${Date.now()}`,
        connectionType: 'USB',
        role: 'RECEIPT',
        paperSize: 'PAPER_58MM',
        receiptCopies: 1,
        autoPrint: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('RECEIPT');
    expect(res.body.data.paperSize).toBe('PAPER_58MM');
  });

  it('GET /api/v1/printers returns list of printers including BOTH role', async () => {
    const res = await request(app)
      .get('/api/v1/printers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const foundBoth = res.body.data.find((p: any) => p.id === printerBothId);
    expect(foundBoth).toBeDefined();
    expect(foundBoth.role).toBe('BOTH');
    expect(foundBoth.paperSize).toBe('PAPER_80MM');
  });

  it('PATCH /api/v1/printers/:id updates printer role to KITCHEN', async () => {
    const res = await request(app)
      .patch(`/api/v1/printers/${printerBothId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'KITCHEN',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('KITCHEN');
  });

  it('P4.3: POST /api/v1/printers supports JSON object configuration', async () => {
    const res = await request(app)
      .post('/api/v1/printers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Printer Network Object ${Date.now()}`,
        connectionType: 'NETWORK',
        addressReference: '192.168.1.88',
        role: 'RECEIPT',
        paperSize: 'PAPER_80MM',
        configuration: {
          charsPerLine: 48,
          baudRate: 115200,
          cutPaper: true,
          ip: '192.168.1.88',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.configuration).toEqual({
      charsPerLine: 48,
      baudRate: 115200,
      cutPaper: true,
      ip: '192.168.1.88',
    });
  });

  it('P4.3: POST /api/v1/printers normalizes stringified JSON configuration to JSON object', async () => {
    const res = await request(app)
      .post('/api/v1/printers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Printer Stringified Config ${Date.now()}`,
        connectionType: 'BLUETOOTH',
        addressReference: '11:22:33:44:55:66',
        role: 'BOTH',
        paperSize: 'PAPER_58MM',
        configuration: JSON.stringify({
          charsPerLine: 32,
          drawerPin: 2,
        }),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.configuration).toEqual({
      charsPerLine: 32,
      drawerPin: 2,
    });
  });
});
