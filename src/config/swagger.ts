import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'General POS API',
      version: '1.0.0',
      description:
        'REST API untuk sistem Point-of-Sale (POS) UMKM. Mendukung manajemen toko, produk, transaksi, inventori, promosi, dan laporan audit.',
      contact: {
        name: 'UMKM POS Team',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API Server v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Masukkan JWT token yang didapat dari endpoint /auth/login',
        },
      },
      schemas: {
        // ──────────────── Common ────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string' },
          },
        },
        // ──────────────── Auth ────────────────
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'password123', format: 'password' },
            storeId: { type: 'string', format: 'uuid', description: 'Opsional jika user hanya ada di 1 toko' },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        // ──────────────── Store ────────────────
        StoreInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Toko Makmur Jaya' },
            address: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
            taxRate: { type: 'number', example: 0.11 },
            currency: { type: 'string', example: 'IDR' },
            timezone: { type: 'string', example: 'Asia/Jakarta' },
          },
        },
        // ──────────────── Product ────────────────
        ProductInput: {
          type: 'object',
          required: ['name', 'price'],
          properties: {
            name: { type: 'string', example: 'Kopi Arabica' },
            sku: { type: 'string' },
            barcode: { type: 'string' },
            categoryId: { type: 'string', format: 'uuid' },
            price: { type: 'number', example: 25000 },
            cost: { type: 'number', example: 12000 },
            stock: { type: 'integer', example: 100 },
            unit: { type: 'string', example: 'cup' },
            active: { type: 'boolean', default: true },
          },
        },
        // ──────────────── Transaction ────────────────
        TransactionItemInput: {
          type: 'object',
          required: ['productId', 'quantity', 'unitPrice', 'subtotal', 'total', 'discountAmount'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' },
            variantId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1 },
            unitPrice: { type: 'number' },
            discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
            discountValue: { type: 'number' },
            discountAmount: { type: 'number' },
            subtotal: { type: 'number' },
            total: { type: 'number' },
          },
        },
        PaymentInput: {
          type: 'object',
          required: ['paymentMethodId', 'amount'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            paymentMethodId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            roundingAmount: { type: 'number', default: 0 },
            metadata: { type: 'object' },
          },
        },
        CompleteTransactionRequest: {
          type: 'object',
          required: ['items', 'payments', 'subtotal', 'discountTotal', 'roundingAmount', 'total'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Opsional, untuk idempotency' },
            transactionNumber: { type: 'string' },
            customerId: { type: 'string', format: 'uuid' },
            promotionId: { type: 'string', format: 'uuid' },
            orderType: { type: 'string', enum: ['DINE_IN', 'TAKE_AWAY', 'DELIVERY', 'ONLINE'] },
            queueNumber: { type: 'string' },
            subtotal: { type: 'number' },
            discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
            discountValue: { type: 'number' },
            discountTotal: { type: 'number' },
            roundingAmount: { type: 'number' },
            total: { type: 'number' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/TransactionItemInput' },
            },
            payments: {
              type: 'array',
              items: { $ref: '#/components/schemas/PaymentInput' },
            },
          },
        },
        // ──────────────── Inventory ────────────────
        StockMovementInput: {
          type: 'object',
          required: ['productId', 'type', 'quantityDelta'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            variantId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN'] },
            quantityDelta: { type: 'integer', example: 50 },
            unitCost: { type: 'number' },
            reason: { type: 'string', example: 'Pembelian stok dari supplier' },
          },
        },
        // ──────────────── Promotion ────────────────
        PromotionInput: {
          type: 'object',
          required: ['name', 'type', 'value', 'startAt', 'endAt'],
          properties: {
            name: { type: 'string', example: 'Diskon Akhir Tahun' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
            value: { type: 'number', example: 20 },
            code: { type: 'string', example: 'DISKON20' },
            startAt: { type: 'string', format: 'date-time' },
            endAt: { type: 'string', format: 'date-time' },
            minimumPurchase: { type: 'number' },
            active: { type: 'boolean', default: true },
          },
        },
        // ──────────────── Refund ────────────────
        RefundItemInput: {
          type: 'object',
          required: ['transactionItemId', 'quantity', 'amount'],
          properties: {
            transactionItemId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1 },
            amount: { type: 'number' },
          },
        },
        RefundRequest: {
          type: 'object',
          required: ['reason', 'items'],
          properties: {
            reason: { type: 'string', example: 'Produk rusak' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/RefundItemInput' },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Autentikasi & otorisasi' },
      { name: 'Store', description: 'Manajemen pengaturan toko' },
      { name: 'Users', description: 'Manajemen pengguna' },
      { name: 'Roles', description: 'Manajemen peran & permission' },
      { name: 'Categories', description: 'Kategori produk' },
      { name: 'Products', description: 'Manajemen produk & varian' },
      { name: 'Inventory', description: 'Pergerakan stok & penyesuaian' },
      { name: 'Customers', description: 'Manajemen pelanggan' },
      { name: 'Transactions', description: 'Transaksi penjualan' },
      { name: 'Refunds', description: 'Pengembalian dana' },
      { name: 'Payments', description: 'Metode pembayaran' },
      { name: 'Promotions', description: 'Promosi & voucher' },
      { name: 'Printers', description: 'Konfigurasi printer struk' },
      { name: 'Audit', description: 'Log audit aktivitas sistem' },
      { name: 'Sync', description: 'Sinkronisasi data offline' },
    ],
    paths: {
      // ════════════════ HEALTH ════════════════
      '/health': {
        get: {
          tags: ['Auth'],
          summary: 'Health check',
          description: 'Cek apakah API berjalan dengan baik',
          security: [],
          responses: {
            '200': { description: 'API aktif', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          },
        },
      },
      // ════════════════ AUTH ════════════════
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login pengguna',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
          },
          responses: {
            '200': { description: 'Login berhasil — mengembalikan accessToken & refreshToken' },
            '401': { description: 'Username atau password salah' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Perbarui access token',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } },
          },
          responses: {
            '200': { description: 'Token baru diberikan' },
            '401': { description: 'Refresh token tidak valid atau kedaluwarsa' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout (invalidate refresh token)',
          responses: {
            '200': { description: 'Logout berhasil' },
          },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Ambil data pengguna yang sedang login',
          responses: {
            '200': { description: 'Data profil pengguna' },
            '401': { description: 'Tidak terautentikasi' },
          },
        },
      },
      // ════════════════ STORE ════════════════
      '/store': {
        get: {
          tags: ['Store'],
          summary: 'Ambil pengaturan toko aktif',
          responses: {
            '200': { description: 'Data toko' },
            '404': { description: 'Toko tidak ditemukan' },
          },
        },
        put: {
          tags: ['Store'],
          summary: 'Perbarui pengaturan toko',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StoreInput' } } },
          },
          responses: {
            '200': { description: 'Data toko berhasil diperbarui' },
          },
        },
      },
      // ════════════════ USERS ════════════════
      '/users': {
        get: {
          tags: ['Users'],
          summary: 'Daftar semua pengguna dalam toko',
          responses: { '200': { description: 'Array pengguna' } },
        },
        post: {
          tags: ['Users'],
          summary: 'Buat pengguna baru',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'password', 'displayName'],
                  properties: {
                    username: { type: 'string' },
                    password: { type: 'string', format: 'password' },
                    displayName: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    roleId: { type: 'string', format: 'uuid' },
                    active: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Pengguna berhasil dibuat' }, '409': { description: 'Username sudah digunakan' } },
        },
      },
      '/users/{id}': {
        get: {
          tags: ['Users'],
          summary: 'Detail pengguna by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'Detail pengguna' }, '404': { description: 'Tidak ditemukan' } },
        },
        put: {
          tags: ['Users'],
          summary: 'Perbarui pengguna',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '200': { description: 'Berhasil diperbarui' } },
        },
        delete: {
          tags: ['Users'],
          summary: 'Hapus (soft-delete) pengguna',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'Pengguna berhasil dinonaktifkan' } },
        },
      },
      // ════════════════ ROLES ════════════════
      '/roles': {
        get: { tags: ['Roles'], summary: 'Daftar peran', responses: { '200': { description: 'Array peran' } } },
        post: {
          tags: ['Roles'],
          summary: 'Buat peran baru',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Kasir' },
                    permissions: { type: 'array', items: { type: 'string' }, example: ['transaction:create', 'product:read'] },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Peran dibuat' } },
        },
      },
      '/roles/{id}': {
        get: { tags: ['Roles'], summary: 'Detail peran', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Detail peran' } } },
        put: { tags: ['Roles'], summary: 'Update peran', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Berhasil' } } },
        delete: { tags: ['Roles'], summary: 'Hapus peran', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Berhasil' } } },
      },
      // ════════════════ CATEGORIES ════════════════
      '/categories': {
        get: { tags: ['Categories'], summary: 'Daftar kategori', responses: { '200': { description: 'Array kategori' } } },
        post: {
          tags: ['Categories'],
          summary: 'Buat kategori baru',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Minuman' },
                    description: { type: 'string' },
                    color: { type: 'string', example: '#3498db' },
                    icon: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Kategori dibuat' } },
        },
      },
      '/categories/{id}': {
        get: { tags: ['Categories'], summary: 'Detail kategori', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
        put: { tags: ['Categories'], summary: 'Update kategori', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'OK' } } },
        delete: { tags: ['Categories'], summary: 'Hapus kategori', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
      },
      // ════════════════ PRODUCTS ════════════════
      '/products': {
        get: {
          tags: ['Products'],
          summary: 'Daftar produk',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Cari by nama/SKU/barcode' },
            { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'activeOnly', in: 'query', schema: { type: 'boolean' }, description: 'Filter hanya produk aktif' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: { '200': { description: 'Array produk dengan paginasi' } },
        },
        post: {
          tags: ['Products'],
          summary: 'Buat produk baru',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } },
          responses: { '201': { description: 'Produk dibuat' }, '409': { description: 'SKU atau barcode sudah digunakan' } },
        },
      },
      '/products/{id}': {
        get: { tags: ['Products'], summary: 'Detail produk', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
        put: { tags: ['Products'], summary: 'Update produk', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'OK' } } },
        delete: { tags: ['Products'], summary: 'Hapus (soft-delete) produk', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
      },
      // ════════════════ INVENTORY ════════════════
      '/stock-movements': {
        get: {
          tags: ['Inventory'],
          summary: 'Riwayat pergerakan stok',
          parameters: [
            { name: 'productId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
          ],
          responses: { '200': { description: 'Array stock movements' } },
        },
        post: {
          tags: ['Inventory'],
          summary: 'Sesuaikan stok produk (STOCK_IN / ADJUSTMENT / dll)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StockMovementInput' } } } },
          responses: { '201': { description: 'Pergerakan stok berhasil dicatat' }, '404': { description: 'Produk tidak ditemukan' } },
        },
      },
      // ════════════════ CUSTOMERS ════════════════
      '/customers': {
        get: {
          tags: ['Customers'],
          summary: 'Daftar pelanggan',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Cari by nama/telepon/email' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: { '200': { description: 'Array pelanggan' } },
        },
        post: {
          tags: ['Customers'],
          summary: 'Tambah pelanggan baru',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Budi Santoso' },
                    phone: { type: 'string', example: '08123456789' },
                    email: { type: 'string', format: 'email' },
                    address: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Pelanggan dibuat' } },
        },
      },
      '/customers/{id}': {
        get: { tags: ['Customers'], summary: 'Detail pelanggan', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
        put: { tags: ['Customers'], summary: 'Update pelanggan', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'OK' } } },
        delete: { tags: ['Customers'], summary: 'Hapus pelanggan', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
      },
      // ════════════════ TRANSACTIONS ════════════════
      '/transactions': {
        get: {
          tags: ['Transactions'],
          summary: 'Daftar transaksi',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'] } },
            { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: { '200': { description: 'Array transaksi dengan total' } },
        },
        post: {
          tags: ['Transactions'],
          summary: 'Selesaikan transaksi (Complete)',
          description: 'Mendukung idempotency: jika `id` sudah ada, akan mengembalikan transaksi yang sudah ada.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CompleteTransactionRequest' } } } },
          responses: {
            '201': { description: 'Transaksi berhasil diselesaikan' },
            '200': { description: 'Transaksi sudah ada sebelumnya (idempotent)' },
            '400': { description: 'Produk tidak aktif atau stok tidak cukup' },
          },
        },
      },
      '/transactions/{id}': {
        get: {
          tags: ['Transactions'],
          summary: 'Detail transaksi by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'Detail transaksi lengkap' }, '404': { description: 'Tidak ditemukan' } },
        },
      },
      '/transactions/{id}/cancel': {
        post: {
          tags: ['Transactions'],
          summary: 'Batalkan transaksi',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reason'],
                  properties: { reason: { type: 'string', example: 'Pelanggan membatalkan pesanan' } },
                },
              },
            },
          },
          responses: { '200': { description: 'Transaksi dibatalkan, stok dikembalikan' } },
        },
      },
      // ════════════════ REFUNDS ════════════════
      '/transactions/{transactionId}/refunds': {
        get: {
          tags: ['Refunds'],
          summary: 'Daftar refund dari suatu transaksi',
          parameters: [{ name: 'transactionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'Array refund' } },
        },
        post: {
          tags: ['Refunds'],
          summary: 'Buat refund untuk transaksi',
          parameters: [{ name: 'transactionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefundRequest' } } } },
          responses: {
            '201': { description: 'Refund berhasil, stok dikembalikan' },
            '400': { description: 'Kuantitas refund melebihi sisa item' },
          },
        },
      },
      // ════════════════ PAYMENT METHODS ════════════════
      '/payment-methods': {
        get: { tags: ['Payments'], summary: 'Daftar metode pembayaran', responses: { '200': { description: 'Array metode pembayaran' } } },
        post: {
          tags: ['Payments'],
          summary: 'Tambah metode pembayaran',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'type'],
                  properties: {
                    name: { type: 'string', example: 'Transfer BCA' },
                    type: { type: 'string', enum: ['CASH', 'CARD', 'DIGITAL_WALLET', 'BANK_TRANSFER', 'OTHER'] },
                    active: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Dibuat' } },
        },
      },
      '/payment-methods/{id}': {
        put: { tags: ['Payments'], summary: 'Update metode pembayaran', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'OK' } } },
        delete: { tags: ['Payments'], summary: 'Hapus metode pembayaran', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
      },
      // ════════════════ PROMOTIONS ════════════════
      '/promotions': {
        get: {
          tags: ['Promotions'],
          summary: 'Daftar promosi',
          parameters: [{ name: 'activeOnly', in: 'query', schema: { type: 'boolean' } }],
          responses: { '200': { description: 'Array promosi' } },
        },
        post: {
          tags: ['Promotions'],
          summary: 'Buat promosi baru',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PromotionInput' } } } },
          responses: { '201': { description: 'Promosi dibuat' } },
        },
      },
      '/promotions/validate': {
        post: {
          tags: ['Promotions'],
          summary: 'Validasi kode voucher',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code', 'subtotal'],
                  properties: {
                    code: { type: 'string', example: 'DISKON20' },
                    subtotal: { type: 'number', example: 100000 },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Hasil validasi',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      valid: { type: 'boolean' },
                      discountAmount: { type: 'number' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/promotions/{id}': {
        get: { tags: ['Promotions'], summary: 'Detail promosi', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
        put: { tags: ['Promotions'], summary: 'Update promosi', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'OK' } } },
        delete: { tags: ['Promotions'], summary: 'Hapus promosi', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
      },
      // ════════════════ PRINTERS ════════════════
      '/printers': {
        get: { tags: ['Printers'], summary: 'Daftar printer', responses: { '200': { description: 'Array printer' } } },
        post: {
          tags: ['Printers'],
          summary: 'Tambah printer',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Kasir Utama' },
                    type: { type: 'string', enum: ['RECEIPT', 'KITCHEN', 'LABEL'] },
                    connectionType: { type: 'string', enum: ['USB', 'NETWORK', 'BLUETOOTH'] },
                    ipAddress: { type: 'string' },
                    port: { type: 'integer', example: 9100 },
                    isDefault: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Printer ditambahkan' } },
        },
      },
      '/printers/{id}': {
        put: { tags: ['Printers'], summary: 'Update printer', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'OK' } } },
        delete: { tags: ['Printers'], summary: 'Hapus printer', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK' } } },
      },
      // ════════════════ AUDIT ════════════════
      '/audit-logs': {
        get: {
          tags: ['Audit'],
          summary: 'Ambil log audit aktivitas sistem',
          parameters: [
            { name: 'entityType', in: 'query', schema: { type: 'string' }, description: 'Filter by tipe entity (Product, Transaction, dll)' },
            { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          ],
          responses: { '200': { description: 'Array log audit' } },
        },
      },
      // ════════════════ SYNC ════════════════
      '/sync/push': {
        post: {
          tags: ['Sync'],
          summary: 'Push data offline ke server',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    transactions: { type: 'array', items: { $ref: '#/components/schemas/CompleteTransactionRequest' } },
                    stockMovements: { type: 'array', items: { $ref: '#/components/schemas/StockMovementInput' } },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Data berhasil disinkronkan' } },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
