import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OmniPOS SaaS API',
      version: '1.0.0',
      description: `
## OmniPOS – RESTful API Documentation

Platform SaaS Point of Sale (POS) Multi-Tenant berbasis **Express.js + Prisma ORM**.

### Autentikasi
Seluruh endpoint yang terproteksi memerlukan **Bearer JWT Token** di header:
\`\`\`
Authorization: Bearer <token>
\`\`\`
Token didapat dari endpoint \`POST /api/auth/login\` atau \`POST /api/auth/register\`.

### Paket Langganan
Beberapa fitur dibatasi berdasarkan paket:
| Paket | Multi-cabang | Multi-user | RBAC |
|-------|-------------|------------|------|
| FREE  | ✗ | ✗ | ✗ |
| PLUS  | ✗ | ✓ | ✓ |
| PRO   | ✓ | ✓ | ✓ |
      `,
      contact: {
        name: 'OmniPOS Support',
        email: 'support@omnipos.app',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Development Server',
      },
    ],
    tags: [
      { name: 'Health', description: 'Status server & koneksi database' },
      { name: 'Auth', description: 'Registrasi, login, profil, pengaturan toko' },
      { name: 'Branches', description: 'Manajemen cabang / outlet toko' },
      { name: 'Users & Employees', description: 'Manajemen staf & karyawan' },
      { name: 'Roles & Permissions', description: 'Manajemen peran RBAC' },
      { name: 'Subscriptions', description: 'Upgrade paket & pembayaran Midtrans' },
      { name: 'Products', description: 'Manajemen produk & varian menu' },
      { name: 'Shifts', description: 'Buka & tutup shift kasir' },
      { name: 'Transactions', description: 'Checkout & riwayat transaksi penjualan' },
      { name: 'Orders', description: 'Pesanan self-order via QR meja' },
      { name: 'Customers', description: 'Database pelanggan terdaftar' },
      { name: 'Promotions', description: 'Promo & diskon toko' },
      { name: 'Public (Self-Order)', description: 'Endpoint publik tanpa autentikasi untuk pelanggan' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token dari endpoint login. Format: `Bearer <token>`',
        },
      },

      // ── Shared Responses ───────────────────────────────────────────────────
      responses: {
        Unauthorized: {
          description: 'Token tidak ditemukan, tidak valid, atau sudah kedaluwarsa',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Token tidak valid atau sudah kedaluwarsa' },
                },
              },
            },
          },
        },
        Forbidden: {
          description: 'Izin tidak mencukupi (RBAC) atau paket langganan tidak memenuhi syarat',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  code: { type: 'string', example: 'PLAN_RESTRICTED' },
                  message: {
                    type: 'string',
                    example: 'Fitur ini hanya tersedia pada paket PRO.',
                  },
                },
              },
            },
          },
        },
        NotFound: {
          description: 'Data tidak ditemukan',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Data tidak ditemukan' },
                },
              },
            },
          },
        },
      },

      // ── Shared Schemas ─────────────────────────────────────────────────────
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-produk-123' },
            name: { type: 'string', example: 'Kopi Susu' },
            description: { type: 'string', example: 'Kopi susu kekinian dengan gula aren', nullable: true },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            variants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'uuid-variant-regular' },
                  name: { type: 'string', example: 'Regular' },
                  price: { type: 'number', example: 18000 },
                  costPrice: { type: 'number', example: 8000 },
                },
              },
            },
          },
        },

        Shift: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-shift-abc123' },
            startTime: { type: 'string', format: 'date-time', example: '2026-10-05T08:00:00.000Z' },
            endTime: { type: 'string', format: 'date-time', nullable: true, example: null },
            startingCash: { type: 'number', example: 500000 },
            endingCash: { type: 'number', nullable: true, example: null },
            status: { type: 'string', enum: ['OPEN', 'CLOSED'], example: 'OPEN' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string', example: 'Kevin' },
              },
            },
            branch: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string', example: 'Cabang Utama' },
              },
            },
          },
        },

        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-trx-xyz' },
            receiptNumber: { type: 'string', example: 'TRX-882194' },
            totalAmount: { type: 'number', example: 54000 },
            paymentMethod: { type: 'string', enum: ['CASH', 'QRIS', 'TRANSFER'], example: 'CASH' },
            cashReceived: { type: 'number', nullable: true, example: 100000 },
            changeAmount: { type: 'number', nullable: true, example: 46000 },
            createdAt: { type: 'string', format: 'date-time' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productName: { type: 'string', example: 'Kopi Susu' },
                  variantName: { type: 'string', example: 'Regular' },
                  quantity: { type: 'integer', example: 2 },
                  price: { type: 'number', example: 18000 },
                  subtotal: { type: 'number', example: 36000 },
                  notes: { type: 'string', example: 'Tanpa es', nullable: true },
                },
              },
            },
          },
        },

        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-order-abc123' },
            orderNumber: { type: 'string', example: 'ORD-882194' },
            status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'CANCELLED'], example: 'PENDING' },
            orderType: { type: 'string', enum: ['DINE_IN', 'TAKEAWAY'], example: 'DINE_IN' },
            tableNumber: { type: 'string', nullable: true, example: '5' },
            customerName: { type: 'string', example: 'Budi' },
            customerPhone: { type: 'string', nullable: true, example: '08123456789' },
            notes: { type: 'string', nullable: true, example: 'Tidak pedas' },
            totalAmount: { type: 'number', example: 54000 },
            createdAt: { type: 'string', format: 'date-time' },
            customer: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                phone: { type: 'string' },
              },
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productName: { type: 'string', example: 'Kopi Susu' },
                  variantName: { type: 'string', example: 'Regular' },
                  quantity: { type: 'integer', example: 2 },
                  price: { type: 'number', example: 18000 },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },

        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-customer-xyz' },
            name: { type: 'string', example: 'Budi Santoso' },
            phone: { type: 'string', nullable: true, example: '08123456789' },
            email: { type: 'string', nullable: true, example: 'budi@gmail.com' },
            address: { type: 'string', nullable: true, example: 'Jl. Merdeka No. 1' },
            notes: { type: 'string', nullable: true, example: 'Pelanggan setia' },
            totalTransactions: { type: 'integer', example: 15 },
            totalSpending: { type: 'number', example: 450000 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        Promotion: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-promo-abc' },
            name: { type: 'string', example: 'Promo Hari Kemerdekaan' },
            code: { type: 'string', nullable: true, example: 'MERDEKA17' },
            description: { type: 'string', nullable: true, example: 'Diskon 17% untuk semua menu' },
            discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED'], example: 'PERCENTAGE' },
            discountValue: { type: 'number', example: 17 },
            maxDiscount: { type: 'number', nullable: true, example: 50000 },
            minPurchase: { type: 'number', nullable: true, example: 50000 },
            scope: { type: 'string', enum: ['ORDER', 'PRODUCT'], example: 'ORDER' },
            scopeVariantIds: {
              type: 'array',
              items: { type: 'string' },
              example: [],
            },
            isActive: { type: 'boolean', example: true },
            startDate: { type: 'string', format: 'date-time', nullable: true },
            endDate: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/**/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI middleware pada endpoint /api-docs
 * @param {import('express').Application} app
 */
export const setupSwagger = (app) => {
  // JSON spec endpoint (berguna untuk tools seperti Postman, Insomnia)
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'OmniPOS API Docs',
      customCss: `
        .swagger-ui .topbar { background: #0f172a; }
        .swagger-ui .topbar-wrapper img { content: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/></svg>'); width: 28px; height: 28px; }
        .swagger-ui .info .title { color: #0f172a; }
        .swagger-ui .btn.authorize { background: #f59e0b; border-color: #f59e0b; color: #fff; }
        .swagger-ui .btn.authorize svg { fill: #fff; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        docExpansion: 'none',
        defaultModelsExpandDepth: 2,
      },
    })
  );
};

export default setupSwagger;
