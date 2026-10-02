import prisma from '../lib/prisma.js';

/**
 * GET /api/orders/pending
 * Mengambil daftar pesanan pelanggan yang menggantung / menunggu diproses oleh kasir POS
 * Query: branchId (opsional, jika tidak ada mengambil branch aktif kasir)
 */
export const getPendingOrders = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const branchId = req.query.branchId || req.activeBranchId;

    const where = {
      tenantId,
      status: 'PENDING',
    };

    if (branchId) {
      where.branchId = branchId;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        branch: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    // Pastikan pesanan yang memiliki customerPhone terintegrasi dengan database Customer
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        if (!order.customer && order.customerPhone) {
          try {
            const cleanPhone = String(order.customerPhone).trim();
            let matched = await prisma.customer.findUnique({
              where: {
                tenantId_phone: {
                  tenantId,
                  phone: cleanPhone,
                },
              },
            });

            if (!matched) {
              matched = await prisma.customer.create({
                data: {
                  tenantId,
                  name: order.customerName || 'Pelanggan QR Order',
                  phone: cleanPhone,
                  notes: 'Terdaftar otomatis dari menu self-order',
                },
              });
            }

            if (matched) {
              await prisma.order.update({
                where: { id: order.id },
                data: { customerId: matched.id },
              });
              order.customerId = matched.id;
              order.customer = {
                id: matched.id,
                name: matched.name,
                phone: matched.phone,
                email: matched.email || null,
              };
            }
          } catch (custErr) {
            console.error('Error linking customer in getPendingOrders:', custErr);
          }
        }
        return order;
      })
    );

    return res.status(200).json({
      success: true,
      data: enrichedOrders,
      count: enrichedOrders.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/lookup/:orderNumber
 * Kasir scan barcode atau ketik kode order untuk menarik data pesanan langsung ke keranjang POS
 */
export const lookupOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Kode pesanan wajib diisi.',
      });
    }

    // Bersihkan karakter hash atau spasi
    const cleanNumber = orderNumber.trim().replace(/^#/, '').toUpperCase();

    const order = await prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber: cleanNumber,
      },
      include: {
        customer: true,
        branch: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        transaction: {
          select: { receiptNumber: true, createdAt: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Pesanan dengan kode "${cleanNumber}" tidak ditemukan pada toko ini.`,
      });
    }

    // Integrasikan data pelanggan jika belum terhubung tapi nomor telepon terisi
    if (!order.customer && order.customerPhone) {
      try {
        const cleanPhone = String(order.customerPhone).trim();
        let matched = await prisma.customer.findUnique({
          where: {
            tenantId_phone: {
              tenantId,
              phone: cleanPhone,
            },
          },
        });

        if (!matched) {
          matched = await prisma.customer.create({
            data: {
              tenantId,
              name: order.customerName || 'Pelanggan QR Order',
              phone: cleanPhone,
              notes: 'Terdaftar otomatis dari menu self-order',
            },
          });
        }

        if (matched) {
          await prisma.order.update({
            where: { id: order.id },
            data: { customerId: matched.id },
          });
          order.customerId = matched.id;
          order.customer = matched;
        }
      } catch (custErr) {
        console.error('Error linking customer in lookupOrder:', custErr);
      }
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:id/cancel
 * Membatalkan pesanan yang belum diproses oleh kasir
 */
export const cancelOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan.',
      });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Pesanan tidak dapat dibatalkan karena statusnya sudah "${order.status}".`,
      });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return res.status(200).json({
      success: true,
      message: 'Pesanan berhasil dibatalkan.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
