export interface SystemPermission {
  key: string;
  description: string;
  category: 'STORE' | 'USERS' | 'PRODUCTS' | 'INVENTORY' | 'SALES' | 'PROMOTIONS' | 'PRINTERS' | 'REPORTS' | 'AUDIT' | 'SYNC';
}

export const SYSTEM_PERMISSIONS: SystemPermission[] = [
  // STORE
  { key: 'manage_store', description: 'Mengatur profil dan konfigurasi toko', category: 'STORE' },
  { key: 'view_store', description: 'Melihat profil toko', category: 'STORE' },

  // USERS & ROLES
  { key: 'manage_users', description: 'Membuat, mengubah, dan menonaktifkan pengguna', category: 'USERS' },
  { key: 'view_users', description: 'Melihat daftar pengguna', category: 'USERS' },
  { key: 'manage_roles', description: 'Membuat dan mengatur peran serta hak akses', category: 'USERS' },

  // PRODUCTS & CATEGORIES
  { key: 'manage_products', description: 'Membuat, mengedit, dan menghapus produk serta varian', category: 'PRODUCTS' },
  { key: 'view_products', description: 'Melihat katalog produk dan kategori', category: 'PRODUCTS' },
  { key: 'manage_categories', description: 'Mengelola kategori produk', category: 'PRODUCTS' },

  // INVENTORY
  { key: 'manage_inventory', description: 'Mengubah stok, stok masuk, dan penyesuaian opname', category: 'INVENTORY' },
  { key: 'view_inventory', description: 'Melihat riwayat mutasi buku besar stok', category: 'INVENTORY' },

  // SALES / TRANSACTIONS / REFUNDS
  { key: 'create_transaction', description: 'Membuat dan menyelesaikan transaksi penjualan di kasir', category: 'SALES' },
  { key: 'view_sales', description: 'Melihat riwayat transaksi dan detail penjualan', category: 'SALES' },
  { key: 'cancel_transaction', description: 'Membatalkan transaksi penjualan', category: 'SALES' },
  { key: 'refund_transaction', description: 'Melakukan refund transaksi penuh atau sebagian', category: 'SALES' },
  { key: 'manage_customers', description: 'Mengelola data pelanggan', category: 'SALES' },

  // PROMOTIONS
  { key: 'manage_promotions', description: 'Mengatur promosi, diskon, dan voucher', category: 'PROMOTIONS' },
  { key: 'view_promotions', description: 'Melihat daftar promosi aktif', category: 'PROMOTIONS' },

  // PRINTERS
  { key: 'manage_printers', description: 'Mengatur konfigurasi printer thermal cloud', category: 'PRINTERS' },

  // REPORTS
  { key: 'view_reports', description: 'Melihat laporan penjualan, laba HPP, dan performa produk', category: 'REPORTS' },

  // AUDIT
  { key: 'view_audit_logs', description: 'Melihat riwayat log audit aktivitas', category: 'AUDIT' },

  // SYNC
  { key: 'sync_data', description: 'Melakukan sinkronisasi data offline/cloud', category: 'SYNC' },
];

export const PERMISSION_KEYS = SYSTEM_PERMISSIONS.map((p) => p.key);
