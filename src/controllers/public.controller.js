import prisma from '../lib/prisma.js';

/**
 * Generate kode order unik yang ramah barcode/scanner (cth: "ORD-882194")
 */
function generateOrderNumber() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ORD-${randomPart}`;
}

/**
 * GET /api/public/store/:tenantSlug
 * Mengambil informasi toko, daftar cabang aktif, dan katalog produk untuk halaman pelanggan
 * Query: branchId (opsional)
 */
export const getStoreCatalog = async (req, res, next) => {
  try {
    const { tenantSlug } = req.params;
    const { branchId } = req.query;

    if (!tenantSlug) {
      return res.status(400).json({
        success: false,
        message: 'Slug toko wajib diisi.',
      });
    }

    // 1. Cari tenant berdasarkan slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        branches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            isMain: true,
          },
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: `Toko dengan link "${tenantSlug}" tidak ditemukan.`,
      });
    }

    if (!tenant.branches || tenant.branches.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Toko ini belum memiliki cabang aktif yang dapat menerima pesanan.',
      });
    }

    // 2. Tentukan cabang yang aktif (dari query atau cabang utama)
    let selectedBranch = null;
    if (branchId) {
      selectedBranch = tenant.branches.find((b) => b.id === branchId) || null;
    }
    if (!selectedBranch) {
      selectedBranch = tenant.branches.find((b) => b.isMain) || tenant.branches[0];
    }

    // 3. Ambil semua produk yang tersedia untuk cabang ini (branchId null atau cocok)
    const products = await prisma.product.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { branchId: null },
          { branchId: selectedBranch.id },
        ],
      },
      include: {
        variants: {
          orderBy: { price: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        branches: tenant.branches,
        activeBranch: selectedBranch,
        products,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/public/orders
 * Pelanggan membuat pesanan mandiri (self-order) yang menghasilkan kode/barcode tiket
 * Body: { tenantSlug, branchId, customerName, customerPhone, orderType, tableNumber, notes, items }
 */
export const createPublicOrder = async (req, res, next) => {
  try {
    const {
      tenantSlug,
      branchId,
      customerName,
      customerPhone,
      orderType = 'DINE_IN',
      tableNumber,
      notes,
      items,
    } = req.body;

    // 1. Validasi data utama
    if (!tenantSlug) {
      return res.status(400).json({ success: false, message: 'Slug toko wajib diisi.' });
    }
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Cabang toko wajib dipilih.' });
    }
    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return res.status(400).json({ success: false, message: 'Nama pemesan wajib diisi.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Keranjang pesanan tidak boleh kosong.' });
    }

    // 2. Cek tenant dan branch
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true },
    });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Toko tidak ditemukan.' });
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId: tenant.id, isActive: true },
    });
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Cabang toko tidak valid atau tidak aktif.' });
    }

    // 3. Validasi & query item varian produk dari DB
    const variantIds = items.map((i) => i.productVariantId).filter(Boolean);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: { select: { id: true, name: true, tenantId: true, isActive: true } },
      },
    });

    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const variant = variants.find((v) => v.id === item.productVariantId);
      if (!variant) {
        return res.status(404).json({
          success: false,
          message: `Menu dengan ID ${item.productVariantId} tidak ditemukan.`,
        });
      }
      if (variant.product.tenantId !== tenant.id || !variant.product.isActive) {
        return res.status(403).json({
          success: false,
          message: `Menu "${variant.product.name}" sedang tidak tersedia.`,
        });
      }

      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const price = parseFloat(variant.price);
      const costPrice = parseFloat(variant.costPrice || 0);
      const subtotal = price * qty;

      totalAmount += subtotal;
      orderItemsData.push({
        productVariantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        price,
        costPrice,
        quantity: qty,
        subtotal,
        notes: item.notes?.trim() || null,
      });
    }

    // 4. Sinkronisasi pelanggan ke Database Pelanggan (jika nomor telepon diisi)
    let linkedCustomerId = null;
    const cleanPhone = customerPhone ? String(customerPhone).trim() : null;

    if (cleanPhone) {
      const existingCustomer = await prisma.customer.findUnique({
        where: {
          tenantId_phone: {
            tenantId: tenant.id,
            phone: cleanPhone,
          },
        },
      });

      if (existingCustomer) {
        linkedCustomerId = existingCustomer.id;
      } else {
        // Otomatis daftarkan pelanggan baru
        const newCustomer = await prisma.customer.create({
          data: {
            tenantId: tenant.id,
            name: customerName.trim(),
            phone: cleanPhone,
            notes: 'Terdaftar otomatis dari menu self-order meja/online',
          },
        });
        linkedCustomerId = newCustomer.id;
      }
    }

    // 5. Generate Order Number yang unik
    let orderNumber;
    let attempts = 0;
    while (attempts < 5) {
      orderNumber = generateOrderNumber();
      const existing = await prisma.order.findUnique({ where: { orderNumber } });
      if (!existing) break;
      attempts++;
    }

    // 6. Buat record Order & OrderItems dalam satu DB transaction
    const order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          orderNumber,
          tenantId: tenant.id,
          branchId: branch.id,
          customerId: linkedCustomerId,
          customerName: customerName.trim(),
          customerPhone: cleanPhone,
          orderType: orderType === 'TAKEAWAY' ? 'TAKEAWAY' : 'DINE_IN',
          tableNumber: tableNumber ? String(tableNumber).trim() : null,
          status: 'PENDING',
          totalAmount,
          notes: notes?.trim() || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
          customer: true,
          branch: {
            select: { id: true, name: true },
          },
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: 'Pesanan berhasil dibuat. Tunjukkan barcode ini ke kasir untuk proses pembayaran.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/orders/:orderNumber
 * Mengecek status pesanan pelanggan dan detail tiket barcode
 */
export const getPublicOrderStatus = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    if (!orderNumber) {
      return res.status(400).json({ success: false, message: 'Nomor pesanan wajib diisi.' });
    }

    const cleanNumber = orderNumber.trim().toUpperCase();

    const order = await prisma.order.findUnique({
      where: { orderNumber: cleanNumber },
      include: {
        tenant: {
          select: { name: true, slug: true },
        },
        branch: {
          select: { name: true, address: true, phone: true },
        },
        customer: true,
        items: true,
        transaction: {
          select: { receiptNumber: true, paymentMethod: true, createdAt: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Pesanan dengan kode "${cleanNumber}" tidak ditemukan.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
