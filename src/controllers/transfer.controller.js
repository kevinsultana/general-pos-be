import prisma from '../lib/prisma.js';
import crypto from 'crypto';

const getFormattedDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

/**
 * Mendapatkan daftar riwayat transfer stok antar cabang
 * GET /api/transfers
 */
export const getTransfers = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, fromBranchId, toBranchId } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where = {
      tenantId: req.tenantId,
      ...(status && { status }),
      ...(fromBranchId && { fromBranchId }),
      ...(toBranchId && { toBranchId }),
    };

    const [total, transfers] = await Promise.all([
      prisma.stockTransfer.count({ where }),
      prisma.stockTransfer.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          sender: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: transfers,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error getTransfers:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data transfer stok.',
      error: error.message,
    });
  }
};

/**
 * Membuat pengiriman transfer stok antar cabang baru (Atomic Transaction)
 * POST /api/transfers
 */
export const createTransfer = async (req, res) => {
  try {
    const { fromBranchId, toBranchId, notes, items = [] } = req.body;

    if (!fromBranchId || !toBranchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang pengirim dan cabang penerima wajib ditentukan.',
      });
    }

    if (fromBranchId === toBranchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang tujuan tidak boleh sama dengan cabang pengirim.',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pilih minimal satu item produk untuk ditransfer.',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { slug: true },
    });

    const dateStr = getFormattedDateString();
    const randomSuffix = crypto.randomInt(1000, 9999);
    const transferNo = `TRF-${tenant?.slug?.toUpperCase() || 'POS'}-${dateStr}-${randomSuffix}`;

    const createdTransfer = await prisma.$transaction(async (tx) => {
      // 1. Verifikasi kedua cabang milik tenant
      const [fromBranch, toBranch] = await Promise.all([
        tx.branch.findFirst({ where: { id: fromBranchId, tenantId: req.tenantId } }),
        tx.branch.findFirst({ where: { id: toBranchId, tenantId: req.tenantId } }),
      ]);

      if (!fromBranch || !toBranch) {
        throw new Error('Cabang asal atau cabang tujuan tidak valid.');
      }

      const transferItemsData = [];

      // 2. Validasi stok cabang asal dan kurangi stok
      for (const item of items) {
        const qty = Math.max(0.01, parseFloat(item.quantity) || 1);

        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId: req.tenantId },
        });

        if (!product) {
          throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan.`);
        }

        const stock = await tx.productStock.findUnique({
          where: {
            productId_branchId: {
              productId: product.id,
              branchId: fromBranchId,
            },
          },
        });

        const currentQty = stock?.quantity || 0;
        if (currentQty < qty) {
          throw new Error(`Stok produk "${product.name}" di ${fromBranch.name} tidak mencukupi (Tersedia: ${currentQty}, Diminta: ${qty}).`);
        }

        // Potong stok di cabang asal
        await tx.productStock.update({
          where: {
            productId_branchId: {
              productId: product.id,
              branchId: fromBranchId,
            },
          },
          data: {
            quantity: { decrement: qty },
          },
        });

        transferItemsData.push({
          productId: product.id,
          productName: product.name,
          quantity: qty,
        });
      }

      // 3. Buat record StockTransfer
      const transfer = await tx.stockTransfer.create({
        data: {
          transferNo,
          tenantId: req.tenantId,
          fromBranchId,
          toBranchId,
          senderId: req.user.id,
          status: 'PENDING',
          notes: notes?.trim() || null,
          items: {
            create: transferItemsData,
          },
        },
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          items: true,
        },
      });

      return transfer;
    });

    return res.status(201).json({
      success: true,
      message: 'Pengiriman transfer stok berhasil dibuat dan stok cabang asal telah dipotong.',
      data: createdTransfer,
    });
  } catch (error) {
    console.error('Error createTransfer:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Gagal memproses transfer stok.',
    });
  }
};

/**
 * Konfirmasi penerimaan transfer stok di cabang tujuan (Atomic Transaction)
 * PATCH /api/transfers/:id/receive
 */
export const receiveTransfer = async (req, res) => {
  try {
    const { id } = req.params;

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, tenantId: req.tenantId },
      include: { items: true },
    });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Data transfer stok tidak ditemukan.',
      });
    }

    if (transfer.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Transfer stok ini tidak dapat diterima karena berstatus ${transfer.status}.`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Tambah stok pada cabang penerima (toBranchId)
      for (const item of transfer.items) {
        await tx.productStock.upsert({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: transfer.toBranchId,
            },
          },
          update: {
            quantity: { increment: item.quantity },
          },
          create: {
            productId: item.productId,
            branchId: transfer.toBranchId,
            quantity: item.quantity,
            minStock: 5,
          },
        });
      }

      // 2. Ubah status transfer menjadi RECEIVED
      const receivedTransfer = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receiverId: req.user.id,
          receivedAt: new Date(),
        },
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
          items: true,
        },
      });

      return receivedTransfer;
    });

    return res.status(200).json({
      success: true,
      message: 'Transfer stok berhasil diterima dan stok di cabang tujuan telah ditambahkan.',
      data: updated,
    });
  } catch (error) {
    console.error('Error receiveTransfer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses penerimaan transfer stok.',
      error: error.message,
    });
  }
};

/**
 * Membatalkan pengiriman transfer stok dan mengembalikan stok ke cabang pengirim (Atomic Transaction)
 * PATCH /api/transfers/:id/cancel
 */
export const cancelTransfer = async (req, res) => {
  try {
    const { id } = req.params;

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, tenantId: req.tenantId },
      include: { items: true },
    });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Data transfer stok tidak ditemukan.',
      });
    }

    if (transfer.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Transfer stok ini tidak dapat dibatalkan karena berstatus ${transfer.status}.`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Kembalikan stok ke cabang pengirim (fromBranchId)
      for (const item of transfer.items) {
        await tx.productStock.upsert({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: transfer.fromBranchId,
            },
          },
          update: {
            quantity: { increment: item.quantity },
          },
          create: {
            productId: item.productId,
            branchId: transfer.fromBranchId,
            quantity: item.quantity,
            minStock: 5,
          },
        });
      }

      // 2. Ubah status transfer menjadi CANCELLED
      const cancelledTransfer = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          items: true,
        },
      });

      return cancelledTransfer;
    });

    return res.status(200).json({
      success: true,
      message: 'Transfer stok berhasil dibatalkan dan stok dikembalikan ke cabang pengirim.',
      data: updated,
    });
  } catch (error) {
    console.error('Error cancelTransfer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membatalkan transfer stok.',
      error: error.message,
    });
  }
};
