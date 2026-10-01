import prisma from '../lib/prisma.js';
import crypto from 'crypto';

/**
 * Helper: Format YYYYMMDD
 */
const getFormattedDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

/**
 * Controller: Mendapatkan daftar Purchase Order
 * GET /api/purchase-orders
 * Protected: authenticate, requirePermission('inventory:view')
 */
export const getPurchaseOrders = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const {
      page = 1,
      limit = 20,
      status,
      branchId,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const where = { tenantId };

    if (status) {
      where.status = status;
    }

    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    } else if (!branchId && req.activeBranchId) {
      where.branchId = req.activeBranchId;
    }

    const [pos, totalCount] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, name: true, phone: true, contactName: true },
          },
          branch: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, name: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, cogs: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parsedLimit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: pos,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Membuat pesanan pembelian baru (Purchase Order)
 * POST /api/purchase-orders
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const createPurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user.id;
    const branchId = req.activeBranchId;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang aktif tidak terdeteksi. Silakan pilih cabang terlebih dahulu.',
      });
    }

    const {
      supplierId,
      orderDate,
      notes = null,
      items = [],
      status = 'ORDERED',
    } = req.body;

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: 'Pemasok (supplierId) wajib dipilih.',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Purchase Order wajib memiliki minimal 1 item produk yang dipesan.',
      });
    }

    // Pastikan supplier milik tenant
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Pemasok tidak ditemukan.',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    const dateStr = getFormattedDateString();
    const randomSuffix = crypto.randomInt(1000, 9999);
    const poNumber = `PO-${tenant?.slug?.toUpperCase() || 'POS'}-${dateStr}-${randomSuffix}`;

    // Validasi item dan hitung subtotal & totalAmount
    let totalAmount = 0;
    const poItemsData = [];

    for (const item of items) {
      if (!item.productId) {
        return res.status(400).json({
          success: false,
          message: 'Setiap baris item PO harus memiliki productId.',
        });
      }

      const product = await prisma.product.findFirst({
        where: { id: item.productId, tenantId },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Produk dengan ID ${item.productId} tidak ditemukan.`,
        });
      }

      const quantity = Math.max(0.01, parseFloat(item.quantity) || 1);
      const costPrice = Math.max(0, parseInt(item.costPrice, 10) || product.cogs || 0);
      const subtotal = Math.round(quantity * costPrice);
      totalAmount += subtotal;

      poItemsData.push({
        productId: product.id,
        productName: product.name,
        quantity,
        costPrice,
        subtotal,
      });
    }

    const newPO = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        tenantId,
        branchId,
        supplierId,
        userId,
        status: ['DRAFT', 'ORDERED'].includes(status) ? status : 'ORDERED',
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        totalAmount,
        notes: notes ? notes.trim() : null,
        items: {
          create: poItemsData,
        },
      },
      include: {
        supplier: true,
        branch: { select: { id: true, name: true } },
        items: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Purchase Order berhasil dibuat.',
      data: newPO,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Konfirmasi penerimaan barang PO ke cabang aktif (tambah stok & update HPP)
 * PATCH /api/purchase-orders/:id/receive
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const receivePurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const branchId = req.activeBranchId;

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
      },
    });

    if (!po) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Order tidak ditemukan.',
      });
    }

    if (po.status === 'RECEIVED') {
      return res.status(400).json({
        success: false,
        message: 'Purchase Order ini sudah diterima sebelumnya.',
      });
    }

    if (po.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Purchase Order yang sudah dibatalkan tidak dapat diterima.',
      });
    }

    const updatedPO = await prisma.$transaction(async (tx) => {
      // 1. Update status PO menjadi RECEIVED
      const received = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
        },
        include: {
          items: true,
          supplier: true,
          branch: true,
        },
      });

      // 2. Tambahkan kuantitas ke ProductStock cabang aktif & perbarui cogs produk
      for (const item of po.items) {
        await tx.productStock.upsert({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: po.branchId,
            },
          },
          update: {
            quantity: {
              increment: item.quantity,
            },
          },
          create: {
            productId: item.productId,
            branchId: po.branchId,
            quantity: item.quantity,
            minStock: 5,
          },
        });

        // Update HPP jika harga beli modal baru > 0
        if (item.costPrice > 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              cogs: item.costPrice,
            },
          });
        }
      }

      return received;
    });

    return res.status(200).json({
      success: true,
      message: 'Barang dari Purchase Order berhasil diterima dan stok telah bertambah.',
      data: updatedPO,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Membatalkan Purchase Order
 * PATCH /api/purchase-orders/:id/cancel
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const cancelPurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
    });

    if (!po) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Order tidak ditemukan.',
      });
    }

    if (po.status === 'RECEIVED') {
      return res.status(400).json({
        success: false,
        message: 'Purchase Order yang sudah diterima tidak dapat dibatalkan.',
      });
    }

    const cancelled = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return res.status(200).json({
      success: true,
      message: 'Purchase Order berhasil dibatalkan.',
      data: cancelled,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
};
