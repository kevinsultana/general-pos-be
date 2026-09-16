import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SYSTEM_PERMISSIONS } from '../src/config/permissions.js';

const prisma = new PrismaClient();

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('Seeding Cloud POS database...');

  // 1. Seed Store
  const store = await prisma.store.upsert({
    where: { id: DEFAULT_STORE_ID },
    update: {},
    create: {
      id: DEFAULT_STORE_ID,
      name: 'TOKO UMKM POS INDONESIA',
      ownerName: 'Pemilik Toko UMKM',
      address: 'Jl. Merdeka No. 45, Jakarta Pusat',
      phone: '08123456789',
      email: 'owner@umkmpos.id',
      currency: 'IDR',
      timezone: 'Asia/Jakarta',
      language: 'id',
      businessType: 'GENERAL',
      customerEnabled: true,
      draftEnabled: true,
      splitPaymentEnabled: true,
      refundEnabled: true,
      cashRoundingEnabled: true,
      cashRoundingIncrement: 100,
      cashRoundingMode: 'ROUND_NEAREST',
    },
  });
  console.log(`Store seeded: ${store.name} (${store.id})`);

  // 2. Seed Permissions
  console.log('Seeding system permissions...');
  for (const perm of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: {
        key: perm.key,
        description: perm.description,
      },
    });
  }

  const allPermissions = await prisma.permission.findMany();

  // 3. Seed Default System Roles
  console.log('Seeding default roles...');

  // Role: Owner
  const ownerRole = await prisma.role.upsert({
    where: {
      storeId_name: {
        storeId: store.id,
        name: 'Owner',
      },
    },
    update: { isSystem: true },
    create: {
      storeId: store.id,
      name: 'Owner',
      description: 'Pemilik Toko dengan hak akses penuh ke seluruh fitur dan pengaturan',
      isSystem: true,
    },
  });

  // Assign ALL permissions to Owner
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: ownerRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: ownerRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Role: Admin
  const adminRole = await prisma.role.upsert({
    where: {
      storeId_name: {
        storeId: store.id,
        name: 'Admin',
      },
    },
    update: { isSystem: true },
    create: {
      storeId: store.id,
      name: 'Admin',
      description: 'Manajer Toko untuk manajemen produk, inventori, laporan, dan promosi',
      isSystem: true,
    },
  });

  const adminPermissionKeys = [
    'view_store',
    'view_users',
    'manage_products',
    'view_products',
    'manage_categories',
    'manage_inventory',
    'view_inventory',
    'create_transaction',
    'view_sales',
    'cancel_transaction',
    'refund_transaction',
    'manage_customers',
    'manage_promotions',
    'view_promotions',
    'manage_printers',
    'view_reports',
    'view_audit_logs',
    'sync_data',
  ];

  for (const perm of allPermissions.filter((p) => adminPermissionKeys.includes(p.key))) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Role: Cashier
  const cashierRole = await prisma.role.upsert({
    where: {
      storeId_name: {
        storeId: store.id,
        name: 'Cashier',
      },
    },
    update: { isSystem: true },
    create: {
      storeId: store.id,
      name: 'Cashier',
      description: 'Kasir untuk input transaksi, melihat produk, dan mencetak struk',
      isSystem: true,
    },
  });

  const cashierPermissionKeys = [
    'view_store',
    'view_products',
    'create_transaction',
    'view_sales',
    'manage_customers',
    'view_promotions',
    'manage_printers',
    'sync_data',
  ];

  for (const perm of allPermissions.filter((p) => cashierPermissionKeys.includes(p.key))) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: cashierRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: cashierRole.id,
        permissionId: perm.id,
      },
    });
  }

  // 4. Seed Default Owner User: owner / owner123
  console.log('Seeding default owner user...');
  const passwordHash = await bcrypt.hash('owner123', 10);
  const user = await prisma.user.upsert({
    where: {
      storeId_username: {
        storeId: store.id,
        username: 'owner',
      },
    },
    update: {
      active: true,
      roleId: ownerRole.id,
    },
    create: {
      storeId: store.id,
      username: 'owner',
      email: 'owner@umkmpos.id',
      passwordHash,
      displayName: 'Owner Administrator',
      active: true,
      roleId: ownerRole.id,
    },
  });
  console.log(`Default owner user seeded: ${user.username} (Password: owner123)`);

  // 5. Seed Default Payment Methods
  console.log('Seeding payment methods...');
  const paymentMethods = [
    { type: 'CASH' as const, name: 'Tunai' },
    { type: 'QRIS' as const, name: 'QRIS' },
    { type: 'TRANSFER' as const, name: 'Transfer Bank' },
    { type: 'DEBIT' as const, name: 'Kartu Debit' },
    { type: 'CREDIT' as const, name: 'Kartu Kredit' },
  ];

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: {
        storeId_name: {
          storeId: store.id,
          name: pm.name,
        },
      },
      update: { enabled: true },
      create: {
        storeId: store.id,
        type: pm.type,
        name: pm.name,
        enabled: true,
      },
    });
  }

  // 6. Seed Default Category
  const defaultCategory = await prisma.category.upsert({
    where: {
      storeId_name: {
        storeId: store.id,
        name: 'Umum',
      },
    },
    update: {},
    create: {
      storeId: store.id,
      name: 'Umum',
      active: true,
    },
  });
  console.log(`Default category seeded: ${defaultCategory.name}`);

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
