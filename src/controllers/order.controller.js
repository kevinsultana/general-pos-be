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
 * Controller: Membuat transaksi order penjualan baru dari terminal POS
 * POST /api/orders
 * Protected: authenticate, requirePermission('pos:access')
 */
export const createOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const cashierId = req.user.id;
    const branchId = req.activeBranchId;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang aktif kasir tidak terdeteksi. Silakan pilih cabang terlebih dahulu.',
      });
    }

    const {
      orderType = 'DIRECT',
      tableNumber = null,
      customerName = null,
      customerId = null,
      isDebt = false,
      dueDate = null,
      paymentMethod = 'CASH',
      paidAmount = 0,
      discount = 0,
      tax = 0,
      notes = null,
      items = [],
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pesanan harus memiliki minimal 1 item produk.',
      });
    }

    const createdOrder = await prisma.$transaction(async (tx) => {
      // 1. Validasi Shift Kasir yang sedang aktif
      const activeShift = await tx.cashierShift.findFirst({
        where: {
          tenantId,
          branchId,
          userId: cashierId,
          status: 'OPEN',
        },
      });

      if (!activeShift) {
        throw new Error('SHIFT_NOT_OPEN: Anda belum membuka shift kasir. Silakan buka shift dan masukkan modal awal terlebih dahulu.');
      }

      // 2. Ambil data Tenant untuk penomoran struk
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true, name: true },
      });

      // 3. Generate Order Number Unik: ORD-<SLUG>-<YYYYMMDD>-<4DIGIT>
      const dateStr = getFormattedDateString();
      const randomSuffix = crypto.randomInt(1000, 9999);
      const orderNumber = `ORD-${tenant?.slug?.toUpperCase() || 'POS'}-${dateStr}-${randomSuffix}`;

      // 4. Proses Kalkulasi Harga Item & Validasi Produk
      let calculatedSubtotal = 0;
      const orderItemsData = [];
      const stockDeductions = []; // { productId, branchId, qty }

      for (const item of items) {
        if (!item.productId) {
          throw new Error('Setiap item pesanan wajib menyertakan productId.');
        }

        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId },
          include: {
            variants: true,
            unitPrices: true,
          },
        });

        if (!product) {
          throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan.`);
        }

        const quantity = Math.max(0.01, parseFloat(item.quantity) || 1);
        let unitPrice = product.basePrice;
        let variantName = null;
        let unitName = null;

        // Varian jika dipilih
        if (item.variantId) {
          const variant = product.variants.find((v) => v.id === item.variantId);
          if (variant) {
            unitPrice += variant.priceAdj;
            variantName = variant.name;
          }
        }

        // Satuan Bertingkat (UOM) jika dipilih
        if (item.unitId) {
          const unit = product.unitPrices.find((u) => u.id === item.unitId);
          if (unit) {
            unitPrice = unit.price;
            unitName = unit.name;
          }
        }

        // Hitung Modifiers
        let modifierTotal = 0;
        const selectedModifiersData = [];

        if (Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0) {
          for (const mod of item.selectedModifiers) {
            const modPrice = Math.max(0, parseInt(mod.price, 10) || 0);
            const deductQty = Math.max(0.01, parseFloat(mod.deductQty) || 1);
            modifierTotal += modPrice;

            selectedModifiersData.push({
              modifierOptionId: mod.modifierOptionId || null,
              optionName: mod.optionName || 'Opsi Tambahan',
              price: modPrice,
              deductQty,
              inventoryProductId: mod.inventoryProductId || null,
            });

            // Antrekan pengurangan stok bahan baku/produk fisik modifier
            if (mod.inventoryProductId) {
              stockDeductions.push({
                productId: mod.inventoryProductId,
                quantity: deductQty * quantity,
              });
            }
          }
        }

        const itemSubtotal = (unitPrice + modifierTotal) * quantity;
        calculatedSubtotal += Math.round(itemSubtotal);

        // Antrekan pengurangan stok produk utama jika melacak stok & bukan jasa
        if (product.trackStock && !product.isService) {
          stockDeductions.push({
            productId: product.id,
            quantity: quantity,
          });
        }

        orderItemsData.push({
          productId: product.id,
          variantId: item.variantId || null,
          unitId: item.unitId || null,
          productName: product.name,
          variantName,
          unitName,
          unitPrice,
          quantity,
          subtotal: Math.round(itemSubtotal),
          selectedModifiers: selectedModifiersData,
        });
      }

      // 5. Kalkulasi Total Akhir, Piutang (Kasbon), & Uang Kembalian
      const parsedDiscount = Math.max(0, parseInt(discount, 10) || 0);
      const parsedTax = Math.max(0, parseInt(tax, 10) || 0);
      const totalAmount = Math.max(0, calculatedSubtotal - parsedDiscount + parsedTax);
      const parsedPaidAmount = Math.max(0, parseInt(paidAmount, 10) || 0);

      let paymentStatus = 'PAID';
      let remainingDebt = 0;
      let changeAmount = 0;

      if (isDebt || parsedPaidAmount < totalAmount) {
        if (!customerId) {
          throw new Error('Transaksi kasbon / bayar nanti mewajibkan memilih atau mendaftarkan pelanggan.');
        }
        remainingDebt = Math.max(0, totalAmount - parsedPaidAmount);
        paymentStatus = parsedPaidAmount > 0 ? 'PARTIAL' : 'UNPAID';
        changeAmount = 0;
      } else {
        paymentStatus = 'PAID';
        remainingDebt = 0;
        changeAmount = parsedPaidAmount - totalAmount;
      }

      // 6. Buat Record Order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          tenantId,
          branchId,
          cashierId,
          shiftId: activeShift.id,
          orderType,
          tableNumber: tableNumber ? String(tableNumber).trim() : null,
          customerName: customerName ? String(customerName).trim() : null,
          customerId: customerId || null,
          remainingDebt,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: 'COMPLETED',
          paymentStatus,
          paymentMethod,
          subtotal: calculatedSubtotal,
          discount: parsedDiscount,
          tax: parsedTax,
          totalAmount,
          paidAmount: parsedPaidAmount,
          changeAmount,
          notes: notes ? String(notes).trim() : null,
          items: {
            create: orderItemsData.map((oi) => ({
              productId: oi.productId,
              variantId: oi.variantId,
              unitId: oi.unitId,
              productName: oi.productName,
              variantName: oi.variantName,
              unitName: oi.unitName,
              unitPrice: oi.unitPrice,
              quantity: oi.quantity,
              subtotal: oi.subtotal,
              selectedModifiers: {
                create: oi.selectedModifiers,
              },
            })),
          },
        },
        include: {
          items: {
            include: {
              selectedModifiers: true,
            },
          },
          cashier: {
            select: { id: true, name: true, email: true },
          },
          branch: {
            select: { id: true, name: true, address: true, phone: true },
          },
          tenant: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      // 7. Eksekusi Pengurangan Stok Otomatis pada ProductStock Cabang Aktif
      for (const deduction of stockDeductions) {
        await tx.productStock.upsert({
          where: {
            productId_branchId: {
              productId: deduction.productId,
              branchId,
            },
          },
          update: {
            quantity: {
              decrement: deduction.quantity,
            },
          },
          create: {
            productId: deduction.productId,
            branchId,
            quantity: -deduction.quantity,
            minStock: 5,
          },
        });
      }

      // 8. Update Statistik & Saldo Piutang Pelanggan (jika dikaitkan)
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalOrders: { increment: 1 },
            totalSpent: { increment: totalAmount },
            ...(remainingDebt > 0 && {
              totalDebt: { increment: remainingDebt },
            }),
          },
        });
      }

      return newOrder;
    });

    return res.status(201).json({
      success: true,
      message: 'Transaksi pesanan berhasil diproses.',
      data: createdOrder,
    });
  } catch (error) {
    if (error.message.startsWith('SHIFT_NOT_OPEN')) {
      return res.status(400).json({
        success: false,
        code: 'SHIFT_REQUIRED',
        message: error.message.replace('SHIFT_NOT_OPEN: ', ''),
      });
    }
    if (error.message.startsWith('Uang pembayaran kurang') || error.message.includes('wajib menyertakan')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Controller: Mendapatkan riwayat daftar transaksi penjualan
 * GET /api/orders
 * Protected: authenticate, requirePermission('reports:view')
 */
export const getOrders = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      branchId,
      status,
      paymentMethod,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const where = { tenantId };

    // Filter Cabang (jika branchId === 'all' dan paket PRO, ambil semua cabang)
    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    } else if (!branchId && req.activeBranchId) {
      where.branchId = req.activeBranchId;
    }

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    // Filter Tanggal
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [orders, totalCount, aggregate] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              selectedModifiers: true,
            },
          },
          cashier: {
            select: { id: true, name: true },
          },
          branch: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parsedLimit,
      }),
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      totalSalesAmount: aggregate._sum.totalAmount || 0,
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
 * Controller: Mendapatkan rincian transaksi tunggal untuk cetak ulang nota
 * GET /api/orders/:id
 * Protected: authenticate
 */
export const getOrderById = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            selectedModifiers: true,
          },
        },
        cashier: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true, address: true, phone: true },
        },
        tenant: {
          select: { id: true, name: true, slug: true },
        },
        shift: {
          select: { id: true, openedAt: true, status: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Data transaksi tidak ditemukan atau bukan milik toko Anda.',
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

export default {
  createOrder,
  getOrders,
  getOrderById,
};
