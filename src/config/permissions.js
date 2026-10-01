/**
 * Master Permissions Omni POS
 * Daftar seluruh izin hak akses yang terpusat di sistem (RBAC)
 */
export const SYSTEM_PERMISSIONS = [
  // Pengaturan Toko
  {
    key: 'settings:view',
    group: 'settings',
    label: 'Lihat Pengaturan Toko',
    desc: 'Melihat informasi identitas dan profil toko',
  },
  {
    key: 'settings:manage',
    group: 'settings',
    label: 'Ubah Pengaturan Toko',
    desc: 'Mengubah nama dan konfigurasi umum toko',
  },

  // Manajemen Cabang
  {
    key: 'branches:view',
    group: 'branches',
    label: 'Lihat Daftar Cabang',
    desc: 'Melihat daftar seluruh outlet cabang toko',
  },
  {
    key: 'branches:manage',
    group: 'branches',
    label: 'Kelola Cabang (Tambah/Edit/Nonaktifkan)',
    desc: 'Menambah, mengedit, dan menonaktifkan cabang',
  },

  // Langganan & Upgrade Paket
  {
    key: 'subscriptions:view',
    group: 'subscriptions',
    label: 'Lihat Status Langganan',
    desc: 'Melihat status paket langganan dan tagihan toko',
  },
  {
    key: 'subscriptions:manage',
    group: 'subscriptions',
    label: 'Beli / Upgrade Paket Langganan',
    desc: 'Melakukan transaksi pembayaran dan peningkatan tier paket',
  },

  // RBAC & Peran
  {
    key: 'roles:view',
    group: 'roles',
    label: 'Lihat Daftar Peran & Hak Akses',
    desc: 'Melihat daftar peran karyawan dan rincian izin',
  },
  {
    key: 'roles:manage',
    group: 'roles',
    label: 'Kelola Peran & Checklist Izin',
    desc: 'Membuat, mengubah, dan menghapus peran kustom',
  },

  // Karyawan
  {
    key: 'users:view',
    group: 'users',
    label: 'Lihat Daftar Karyawan',
    desc: 'Melihat daftar akun staf dan penugasan cabang',
  },
  {
    key: 'users:manage',
    group: 'users',
    label: 'Kelola Karyawan (Tambah/Edit/Hapus)',
    desc: 'Menambah, mengedit, dan menghapus akun staf',
  },

  // POS & Kasir
  {
    key: 'pos:access',
    group: 'pos',
    label: 'Akses Terminal Kasir',
    desc: 'Membuka terminal kasir dan melayani transaksi',
  },
  {
    key: 'pos:shift',
    group: 'pos',
    label: 'Buka & Tutup Shift Kasir',
    desc: 'Buka dan tutup shift kasir serta audit laci kas',
  },
  {
    key: 'pos:void',
    group: 'pos',
    label: 'Void / Batalkan Transaksi',
    desc: 'Membatalkan item pesanan yang sudah tercatat',
  },

  // Inventori
  {
    key: 'inventory:view',
    group: 'inventory',
    label: 'Lihat Stok & Produk',
    desc: 'Melihat daftar produk, harga, dan sisa stok',
  },
  {
    key: 'inventory:manage',
    group: 'inventory',
    label: 'Kelola Stok & Produk',
    desc: 'Menambah, mengubah produk, dan penyesuaian stok',
  },

  // Laporan
  {
    key: 'reports:view',
    group: 'reports',
    label: 'Lihat Laporan Penjualan',
    desc: 'Melihat grafik penjualan dan analitik pendapatan',
  },
  {
    key: 'reports:export',
    group: 'reports',
    label: 'Ekspor Data Laporan',
    desc: 'Mengunduh file laporan ke format Excel / PDF',
  },
];

export const PERMISSION_GROUPS = [
  {
    id: 'settings',
    name: 'Pengaturan Toko',
    description: 'Pengaturan identitas toko, profil, dan konfigurasi umum',
  },
  {
    id: 'branches',
    name: 'Manajemen Cabang',
    description: 'Daftar dan operasional outlet cabang toko',
  },
  {
    id: 'subscriptions',
    name: 'Langganan & Upgrade',
    description: 'Status paket langganan dan transaksi pembayaran',
  },
  {
    id: 'roles',
    name: 'Hak Akses & Peran (RBAC)',
    description: 'Administrasi peran dan permission kustom',
  },
  {
    id: 'users',
    name: 'Manajemen Karyawan',
    description: 'Pengelolaan akun staf kasir dan supervisor',
  },
  {
    id: 'pos',
    name: 'Terminal Kasir & POS',
    description: 'Operasional transaksi penjualan dan shift kasir',
  },
  {
    id: 'inventory',
    name: 'Inventori & Produk',
    description: 'Katalog produk, manajemen stok, dan penyesuaian opname',
  },
  {
    id: 'reports',
    name: 'Laporan & Transaksi',
    description: 'Analitik pendapatan, pembukuan, dan ekspor data',
  },
];

/**
 * Helper untuk mengembalikan daftar permission terkelompok per kategori
 */
export const getGroupedPermissions = () => {
  return PERMISSION_GROUPS.map((group) => ({
    ...group,
    permissions: SYSTEM_PERMISSIONS.filter((p) => p.group === group.id),
  }));
};

export default {
  SYSTEM_PERMISSIONS,
  PERMISSION_GROUPS,
  getGroupedPermissions,
};
