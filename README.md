# General POS — Cloud Backend API

Server-side REST API Cloud Platform untuk Generic UMKM POS, dibangun dengan **Node.js**, **TypeScript**, **Express**, **Prisma ORM**, dan database **PostgreSQL**.

---

## Fitur Utama

- **Phase 8 — Cloud Backend Foundation**:
  - Prisma ORM dengan skema relasional 22 model (`PRISMA_SCHEMA.md`).
  - Koneksi PostgreSQL lokal (`general_pos`).
  - Atomic Transaction Completion dengan snapshot HPP historis (`unitCostSnapshot`), pemotongan stok otomatis, dan idempotency support.
  - Pembatalan transaksi kasir & Refund penuh/sebagian dengan pengembalian stok otomatis (`CANCEL_REVERSAL`, `REFUND_REVERSAL`).
  - CRUD Produk, Kategori, Varian, dan Pelanggan.
  - Buku besar mutasi inventori stok (`StockMovement`).
  - Manajemen metode pembayaran, promosi/voucher, dan konfigurasi printer thermal cloud.
- **Phase 9 — Cloud Authentication & Roles**:
  - Autentikasi JWT (Access Token & Refresh Token) dengan enkripsi password `bcryptjs`.
  - Role-Based Access Control (RBAC) di sisi server dengan `requireAuth` dan `requirePermission`.
  - Role sistem bawaan (`Owner`, `Admin`, `Cashier`) dan dukungan kustomisasi peran (*Custom Roles*).
  - Layanan pencatatan audit log otomatis (`AuditService`) untuk semua aksi kritikal ke tabel `AuditLog`.

---

## Persyaratan Sistem

- Node.js >= 20.x (Teruji di Node v24.12.0)
- npm >= 10.x
- PostgreSQL >= 15.x (Teruji di PostgreSQL 17.7 lokal port 5432)

---

## Panduan Menjalankan

### 1. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env`:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/general_pos?schema=public"
JWT_SECRET="umkm-pos-super-secret-jwt-key-change-in-production-2026"
JWT_EXPIRES_IN="1d"
JWT_REFRESH_SECRET="umkm-pos-super-secret-refresh-jwt-key-change-in-production-2026"
JWT_REFRESH_EXPIRES_IN="30d"
```

### 2. Migrasi Database & Seed Awal
```bash
# Generate Prisma client
npm run prisma:generate

# Jalankan migrasi schema ke PostgreSQL
npm run prisma:migrate

# Jalankan data seed awal (Toko, Roles, Permissions, Akun Owner, Metode Pembayaran)
npm run prisma:seed
```

**Akun Default Hasil Seed:**
- **Username**: `owner`
- **Password**: `owner123`
- **Role**: `Owner` (Akses penuh ke seluruh endpoint)

### 3. Menjalankan Server Development
```bash
npm run dev
```
Server akan aktif di: `http://localhost:5000`  
Health check: `http://localhost:5000/api/v1/health`

### 4. Menjalankan Pengujian Otomatis (Vitest)
```bash
npm test
```

### 5. Membangun untuk Produksi (Build & Start)
```bash
npm run build
npm start
```

---

## Ringkasan Endpoint API (`/api/v1`)

### 1. Autentikasi (`/api/v1/auth`)
- `POST /api/v1/auth/login`: Login akun, menerima access token & refresh token.
- `POST /api/v1/auth/refresh`: Memperbarui access token dengan refresh token.
- `GET /api/v1/auth/me`: Mengambil profil pengguna yang sedang login beserta permissions.
- `POST /api/v1/auth/logout`: Keluar dan mencatat audit log.

### 2. Toko (`/api/v1/store`)
- `GET /api/v1/store`: Mengambil data dan pengaturan toko.
- `PATCH /api/v1/store`: Memperbarui pengaturan toko (pembulatan kas, mode resto, dsb).

### 3. Hak Akses & Peran (`/api/v1/roles`)
- `GET /api/v1/roles/permissions`: Daftar seluruh permission sistem yang tersedia.
- `GET /api/v1/roles`: Daftar role toko beserta permissions.
- `GET /api/v1/roles/:id`: Detail role.
- `POST /api/v1/roles`: Membuat custom role baru (Owner).
- `PATCH /api/v1/roles/:id`: Memperbarui nama dan permissions custom role.
- `DELETE /api/v1/roles/:id`: Menghapus custom role.

### 4. Pengguna (`/api/v1/users`)
- `GET /api/v1/users`: Daftar pengguna/kasir toko.
- `GET /api/v1/users/:id`: Detail pengguna.
- `POST /api/v1/users`: Menambahkan kasir/staff baru dengan penetapan role.
- `PATCH /api/v1/users/:id`: Memperbarui data pengguna atau menonaktifkan akun.

### 5. Produk & Kategori (`/api/v1/products`, `/api/v1/categories`)
- `GET /api/v1/categories`, `POST`, `PATCH /:id`, `DELETE /:id`
- `GET /api/v1/products`: Katalog produk (filter `categoryId`, `search`, `lowStockOnly`).
- `POST /api/v1/products`: Membuat produk dengan varian, HPP, harga jual, dan stok awal.
- `PATCH /api/v1/products/:id`: Memperbarui produk (perubahan harga dicatat di audit log).
- `DELETE /api/v1/products/:id`: Menghapus atau menonaktifkan produk secara aman.

### 6. Pelanggan (`/api/v1/customers`)
- `GET /api/v1/customers`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id`

### 7. Inventori & Mutasi Stok (`/api/v1/stock-movements`)
- `GET /api/v1/stock-movements`: Riwayat buku besar stok (IN, SALE, ADJUSTMENT, CANCEL_REVERSAL, REFUND_REVERSAL).
- `POST /api/v1/stock-movements`: Penyesuaian stok manual / stok masuk dengan update saldo atomik.

### 8. Transaksi & Kasir (`/api/v1/transactions`)
- `GET /api/v1/transactions`: Riwayat transaksi penjualan (filter tanggal, status).
- `GET /api/v1/transactions/:id`: Rincian lengkap transaksi, item, pembayaran, dan refund.
- `POST /api/v1/transactions`: Penyelesaian transaksi atomik (potong stok, snapshot HPP, catat penjualan, idempotensi aman).
- `POST /api/v1/transactions/:id/cancel`: Pembatalan transaksi & pengembalian stok otomatis.
- `POST /api/v1/transactions/:id/refunds`: Refund penuh atau sebagian & pengembalian stok otomatis.
- `GET /api/v1/transactions/:id/refunds`: Riwayat refund transaksi.

### 9. Pembayaran, Promosi & Printer
- `GET /api/v1/payment-methods`, `POST`, `PATCH /:id`
- `GET /api/v1/promotions`, `POST`, `PATCH /:id`
- `POST /api/v1/promotions/validate`: Validasi kupon/voucher diskon belanja.
- `GET /api/v1/printers`, `POST`, `PATCH /:id`, `DELETE /:id`

### 10. Audit Log (`/api/v1/audit-logs`)
- `GET /api/v1/audit-logs`: Riwayat audit aktivitas sistem (filter `entityType`, `userId`, `limit`).
