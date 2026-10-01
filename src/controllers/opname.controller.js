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
 * Controller: Mendapatkan riwayat audit stok opname per cabang
 * GET /api/opnames
 * Protected: authenticate, requirePermission('inventory:view')
 */
export const getOpnames = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;

    const where = { tenantId };
    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    }

    const opnames = await prisma.stockOpname.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, basePrice: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.status(200).json({
      success: true,
      data: opnames,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Membuat sesi audit stok opname dan mengkalibrasi kuantitas stok riil
 * POST /api/opnames
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const createOpname = async (req, res, next) => {
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

    const { notes = null, items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sesi stok opname harus memiliki minimal 1 produk untuk diaudit.',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    const dateStr = getFormattedDateString();
    const randomSuffix = crypto.randomInt(1000, 9999);
    const opnameNumber = `OPN-${tenant?.slug?.toUpperCase() || 'POS'}-${dateStr}-${randomSuffix}`;

    const completedOpname = await prisma.$transaction(async (tx) => {
      // 1. Siapkan data item opname dan update ProductStock
      const opnameItemsData = [];

      for (const item of items) {
        if (!item.productId) {
          throw new Error('Setiap baris audit wajib memiliki productId.');
        }

        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId },
        });

        if (!product) {
          throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan.`);
        }

        // Ambil stok sistem saat ini
        const currentStockRecord = await tx.productStock.findUnique({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId,
            },
          },
        });

        const systemQty = currentStockRecord ? currentStockRecord.quantity : 0;
        const physicalQty = parseFloat(item.physicalQty) || 0;
        const difference = physicalQty - systemQty;

        opnameItemsData.push({
          productId: product.id,
          systemQty,
          physicalQty,
          difference,
          reason: item.reason ? item.reason.trim() : null,
        });

        // Kalibrasi kuantitas di ProductStock menjadi persis sama dengan physicalQty
        await tx.productStock.upsert({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId,
            },
          },
          update: {
            quantity: physicalQty,
          },
          create: {
            productId: item.productId,
            branchId,
            quantity: physicalQty,
            minStock: 5,
          },
        });
      }

      // 2. Buat record StockOpname
      const opname = await tx.stockOpname.create({
        data: {
          opnameNumber,
          tenantId,
          branchId,
          userId,
          status: 'COMPLETED',
          completedAt: new Date(),
          notes: notes ? notes.trim() : null,
          items: {
            create: opnameItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
          user: {
            select: { id: true, name: true },
          },
          branch: {
            select: { id: true, name: true },
          },
        },
      });

      return opname;
    });

    return res.status(201).json({
      success: true,
      message: 'Audit stok opname selesai dan stok fisik cabang telah dikalibrasi.',
      data: completedOpname,
    });
  } catch (error) {
    if (error.message.includes('wajib memiliki') || error.message.includes('tidak ditemukan')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export default {
  getOpnames,
  createOpname,
};
