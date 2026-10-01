import prisma from '../lib/prisma.js';

/**
 * Mendapatkan daftar pelanggan milik tenant dengan pagination, pencarian, dan filter piutang
 */
export const getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', hasDebt } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where = {
      tenantId: req.tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(hasDebt === 'true' && { totalDebt: { gt: 0 } }),
      ...(hasDebt === 'false' && { totalDebt: 0 }),
    };

    const [total, customers, totalDebtAgg] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ totalDebt: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.customer.aggregate({
        where: { tenantId: req.tenantId },
        _sum: { totalDebt: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: customers,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        overallTotalDebt: totalDebtAgg._sum.totalDebt || 0,
      },
    });
  } catch (error) {
    console.error('Error getCustomers:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data pelanggan.',
      error: error.message,
    });
  }
};

/**
 * Mendaftarkan pelanggan baru
 */
export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama pelanggan wajib diisi.',
      });
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Pelanggan berhasil ditambahkan.',
      data: customer,
    });
  } catch (error) {
    console.error('Error createCustomer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan pelanggan.',
      error: error.message,
    });
  }
};

/**
 * Memperbarui data profil pelanggan
 */
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, notes } = req.body;

    const existing = await prisma.customer.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Data pelanggan tidak ditemukan.',
      });
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Data pelanggan berhasil diperbarui.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updateCustomer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui pelanggan.',
      error: error.message,
    });
  }
};

/**
 * Menghapus pelanggan (hanya jika totalDebt === 0)
 */
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan.',
      });
    }

    if (customer.totalDebt > 0) {
      return res.status(400).json({
        success: false,
        message: `Pelanggan masih memiliki saldo piutang/kasbon sebesar Rp ${customer.totalDebt.toLocaleString('id-ID')} yang belum lunas.`,
      });
    }

    await prisma.customer.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Data pelanggan berhasil dihapus.',
    });
  } catch (error) {
    console.error('Error deleteCustomer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus pelanggan.',
      error: error.message,
    });
  }
};

/**
 * Mendapatkan detail buku piutang/kasbon pelanggan (daftar order belum lunas & riwayat bayar)
 */
export const getCustomerDebts = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan.',
      });
    }

    const [unpaidOrders, debtPayments] = await Promise.all([
      prisma.order.findMany({
        where: {
          customerId: id,
          tenantId: req.tenantId,
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
        },
        include: {
          branch: { select: { id: true, name: true } },
          items: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.debtPayment.findMany({
        where: {
          customerId: id,
          tenantId: req.tenantId,
        },
        include: {
          branch: { select: { id: true, name: true } },
          cashier: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        customer,
        unpaidOrders,
        debtPayments,
      },
    });
  } catch (error) {
    console.error('Error getCustomerDebts:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data kasbon pelanggan.',
      error: error.message,
    });
  }
};

/**
 * Membayar / melunasi kasbon pelanggan secara bertahap atau lunas penuh (Atomic Transaction)
 */
export const payCustomerDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod = 'CASH', notes } = req.body;

    const payAmount = parseInt(amount, 10);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Nominal pembayaran kasbon harus lebih dari 0.',
      });
    }

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Data pelanggan tidak ditemukan.',
      });
    }

    if (customer.totalDebt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Pelanggan tidak memiliki saldo piutang/kasbon yang belum lunas.',
      });
    }

    if (payAmount > customer.totalDebt) {
      return res.status(400).json({
        success: false,
        message: `Nominal pembayaran (Rp ${payAmount.toLocaleString('id-ID')}) melebihi total kasbon (Rp ${customer.totalDebt.toLocaleString('id-ID')}).`,
      });
    }

    const paymentNo = `PAY-DEBT-${Date.now()}`;

    // Eksekusi Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Catat pembayaran kasbon di DebtPayment
      const payment = await tx.debtPayment.create({
        data: {
          paymentNo,
          tenantId: req.tenantId,
          branchId: req.activeBranchId,
          customerId: id,
          cashierId: req.user.id,
          amount: payAmount,
          paymentMethod: paymentMethod || 'CASH',
          notes: notes?.trim() || null,
        },
      });

      // 2. Kurangi totalDebt pada Customer
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          totalDebt: { decrement: payAmount },
        },
      });

      // 3. Alokasikan pembayaran untuk melunasi order kasbon terlama (FIFO)
      const unpaidOrders = await tx.order.findMany({
        where: {
          customerId: id,
          tenantId: req.tenantId,
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      let remainingToSettle = payAmount;
      for (const order of unpaidOrders) {
        if (remainingToSettle <= 0) break;

        const settleAmount = Math.min(order.remainingDebt, remainingToSettle);
        const newRemaining = order.remainingDebt - settleAmount;
        const newPaid = order.paidAmount + settleAmount;
        const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIAL';

        await tx.order.update({
          where: { id: order.id },
          data: {
            remainingDebt: newRemaining,
            paidAmount: newPaid,
            paymentStatus: newStatus,
          },
        });

        remainingToSettle -= settleAmount;
      }

      // 4. Catat mutasi kas masuk ke shift kasir aktif jika bayar tunai
      if (paymentMethod === 'CASH') {
        const activeShift = await tx.cashierShift.findFirst({
          where: {
            tenantId: req.tenantId,
            branchId: req.activeBranchId,
            userId: req.user.id,
            status: 'OPEN',
          },
        });

        if (activeShift) {
          await tx.cashMovement.create({
            data: {
              shiftId: activeShift.id,
              type: 'CASH_IN',
              amount: payAmount,
              reason: `Pelunasan Kasbon: ${customer.name} (${paymentNo})`,
            },
          });

          await tx.cashierShift.update({
            where: { id: activeShift.id },
            data: {
              expectedCash: { increment: payAmount },
            },
          });
        }
      }

      return { payment, updatedCustomer };
    });

    return res.status(200).json({
      success: true,
      message: `Pembayaran kasbon sebesar Rp ${payAmount.toLocaleString('id-ID')} berhasil dicatat.`,
      data: result,
    });
  } catch (error) {
    console.error('Error payCustomerDebt:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses pembayaran kasbon.',
      error: error.message,
    });
  }
};
