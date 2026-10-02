import prisma from '../lib/prisma.js';

/**
 * Fungsi helper: Generate nomor resi unik
 * Format: RCP-{YYYYMMDD}-{5 digit random}
 */
function generateReceiptNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `RCP-${dateStr}-${rand}`;
}

/**
 * POST /api/transactions/checkout
 * Proses checkout. Backend query harga dari DB — TIDAK menggunakan harga dari payload.
 *
 * Payload:
 * {
 *   shiftId: string,
 *   paymentMethod: string,   // "CASH" | "QRIS" | "TRANSFER"
 *   customerId?: string,
 *   customerName?: string,
 *   customerPhone?: string,
 *   items: [{ productVariantId: string, quantity: number }]
 * }
 */
export const checkout = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;
    const { shiftId, paymentMethod, customerId, customerName, customerPhone, items, orderId, orderNumber } = req.body;

    // Validasi input
    if (!shiftId) {
      return res.status(400).json({ success: false, message: 'shiftId wajib diisi.' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Metode pembayaran wajib dipilih.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Keranjang belanja tidak boleh kosong.' });
    }

    // Validasi shift masih OPEN dan milik tenant + branch ini
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, tenantId, status: 'OPEN' },
    });
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift tidak ditemukan atau sudah ditutup.',
      });
    }

    // Query data variant dari DB (untuk snapshot harga yang aman)
    const variantIds = items.map((i) => i.productVariantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: { select: { name: true, tenantId: true } },
      },
    });

    // Pastikan semua variant ditemukan dan milik tenant ini
    for (const item of items) {
      const v = variants.find((v) => v.id === item.productVariantId);
      if (!v) {
        return res.status(404).json({
          success: false,
          message: `Produk varian dengan ID ${item.productVariantId} tidak ditemukan.`,
        });
      }
      if (v.product.tenantId !== tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Produk bukan milik toko ini.',
        });
      }
      if (!item.quantity || item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Jumlah item harus lebih dari 0.',
        });
      }
    }

    // Hitung total dengan harga dari DB
    let totalAmount = 0;
    let totalCost = 0;
    const transactionItems = items.map((item) => {
      const variant = variants.find((v) => v.id === item.productVariantId);
      const qty = parseInt(item.quantity, 10);
      const itemPrice = parseFloat(variant.price);
      const itemCost = parseFloat(variant.costPrice);
      const subtotal = itemPrice * qty;

      totalAmount += subtotal;
      totalCost += itemCost * qty;

      return {
        productVariantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        quantity: qty,
        costPrice: itemCost,
        price: itemPrice,
        subtotal,
      };
    });

    // Generate receipt number yang unik (retry jika tabrakan)
    let receiptNumber;
    let attempts = 0;
    while (attempts < 5) {
      receiptNumber = generateReceiptNumber();
      const existing = await prisma.transaction.findUnique({ where: { receiptNumber } });
      if (!existing) break;
      attempts++;
    }

    // Buat transaksi dalam satu DB transaction
    const transaction = await prisma.$transaction(async (tx) => {
      const createdTx = await tx.transaction.create({
        data: {
          tenantId,
          branchId: branchId || shift.branchId,
          shiftId,
          customerId: customerId || null,
          customerName: customerName?.trim() || null,
          customerPhone: customerPhone?.trim() || null,
          receiptNumber,
          totalAmount,
          totalCost,
          paymentMethod,
          items: {
            create: transactionItems,
          },
        },
        include: {
          items: true,
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      // Jika transaksi berasal dari order customer (self-order / barcode scan), tandai Order sebagai COMPLETED
      if (orderId || orderNumber) {
        const targetOrder = await tx.order.findFirst({
          where: {
            tenantId,
            ...(orderId ? { id: orderId } : { orderNumber: String(orderNumber).trim().toUpperCase() }),
            status: 'PENDING',
          },
        });

        if (targetOrder) {
          await tx.order.update({
            where: { id: targetOrder.id },
            data: {
              status: 'COMPLETED',
              transactionId: createdTx.id,
            },
          });
        }
      }

      return createdTx;
    });

    return res.status(201).json({
      success: true,
      message: 'Transaksi berhasil dicatat.',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/transactions
 * Daftar transaksi dengan filter: shiftId, startDate, endDate, paymentMethod, page
 */
export const getTransactions = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;
    const { shiftId, startDate, endDate, paymentMethod, page = 1, limit = 30 } = req.query;

    const where = { tenantId };
    if (branchId) where.branchId = branchId;
    if (shiftId) where.shiftId = shiftId;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    // Filter rentang tanggal (berdasarkan hari lokal)
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const take = Math.min(parseInt(limit, 10) || 30, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          items: true,
          customer: {
            select: { id: true, name: true, phone: true, email: true },
          },
          shift: {
            select: {
              id: true,
              startTime: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.transaction.count({ where }),
    ]);

    // Ringkasan agregat untuk periode yang difilter
    const summary = await prisma.transaction.aggregate({
      where,
      _sum: { totalAmount: true, totalCost: true },
      _count: { id: true },
    });

    return res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
      summary: {
        totalTransactions: summary._count.id,
        totalRevenue: summary._sum.totalAmount || 0,
        totalCost: summary._sum.totalCost || 0,
        totalProfit:
          (parseFloat(summary._sum.totalAmount) || 0) -
          (parseFloat(summary._sum.totalCost) || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};
