/**
 * Script satu kali untuk assign produk lama (branchId = null)
 * ke cabang utama (isMain = true) masing-masing tenant.
 *
 * Jalankan SETELAH `npx prisma db push`:
 *   node prisma/seed-branch-products.js
 */
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('🔍 Mencari produk tanpa cabang...');

  const productsWithoutBranch = await prisma.product.findMany({
    where: { branchId: null },
    select: { id: true, tenantId: true, name: true },
  });

  if (productsWithoutBranch.length === 0) {
    console.log('✅ Tidak ada produk tanpa cabang. Selesai.');
    return;
  }

  console.log(`📦 Ditemukan ${productsWithoutBranch.length} produk tanpa cabang.`);

  // Kelompokkan per tenant
  const byTenant = {};
  for (const p of productsWithoutBranch) {
    if (!byTenant[p.tenantId]) byTenant[p.tenantId] = [];
    byTenant[p.tenantId].push(p.id);
  }

  let totalUpdated = 0;

  for (const [tenantId, productIds] of Object.entries(byTenant)) {
    // Ambil cabang utama tenant ini
    const mainBranch = await prisma.branch.findFirst({
      where: { tenantId, isMain: true },
      select: { id: true, name: true },
    }) || await prisma.branch.findFirst({
      where: { tenantId },
      select: { id: true, name: true },
    });

    if (!mainBranch) {
      console.warn(`⚠️  Tenant ${tenantId} tidak punya cabang, skip ${productIds.length} produk.`);
      continue;
    }

    const updated = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { branchId: mainBranch.id },
    });

    console.log(
      `✅ Tenant ${tenantId}: ${updated.count} produk di-assign ke cabang "${mainBranch.name}" (${mainBranch.id})`
    );
    totalUpdated += updated.count;
  }

  console.log(`\n🎉 Selesai! Total ${totalUpdated} produk berhasil di-assign ke cabang.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
