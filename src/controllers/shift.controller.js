import prisma from '../lib/prisma.js';

/**
 * Controller: Mendapatkan status shift kasir aktif saat ini beserta kalkulasi kas realtime
 * GET /api/shifts/current
 * Protected: authenticate, requirePermission('pos:shift')
 */
export const getCurrentShift = async (req, res, next) => {
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

    const currentShift = await prisma.cashierShift.findFirst({
      where: {
        tenantId,
        branchId,
        userId,
        status: 'OPEN',
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        movements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!currentShift) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Tidak ada shift kasir yang sedang aktif.',
      });
    }

    // Hitung realtime total penjualan tunai dari order di shift ini
    const cashOrders = await prisma.order.aggregate({
      where: {
        shiftId: currentShift.id,
        status: 'COMPLETED',
        paymentMethod: 'CASH',
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // Hitung total Cash In dan Cash Out
    let totalCashIn = 0;
    let totalCashOut = 0;
    currentShift.movements.forEach((m) => {
      if (m.type === 'CASH_IN') totalCashIn += m.amount;
      if (m.type === 'CASH_OUT') totalCashOut += m.amount;
    });

    const totalCashSales = cashOrders._sum.totalAmount || 0;
    const expectedCash = currentShift.startingCash + totalCashSales + totalCashIn - totalCashOut;

    return res.status(200).json({
      success: true,
      data: {
        ...currentShift,
        totalCashSales,
        totalCashOrders: cashOrders._count.id || 0,
        totalCashIn,
        totalCashOut,
        expectedCash,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Membuka shift kasir baru dengan modal awal
 * POST /api/shifts/open
 * Protected: authenticate, requirePermission('pos:shift')
 */
export const openShift = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user.id;
    const branchId = req.activeBranchId;
    const { startingCash = 0, notes = '' } = req.body;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang aktif tidak terdeteksi. Silakan pilih cabang terlebih dahulu.',
      });
    }

    const parsedStartingCash = Math.max(0, parseInt(startingCash, 10) || 0);

    // Cek apakah kasir sudah memiliki shift aktif di cabang ini
    const existingOpenShift = await prisma.cashierShift.findFirst({
      where: {
        tenantId,
        branchId,
        userId,
        status: 'OPEN',
      },
    });

    if (existingOpenShift) {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah memiliki shift kasir yang aktif. Harap tutup shift sebelumnya terlebih dahulu.',
        data: existingOpenShift,
      });
    }

    const shift = await prisma.cashierShift.create({
      data: {
        tenantId,
        branchId,
        userId,
        startingCash: parsedStartingCash,
        expectedCash: parsedStartingCash,
        notes: notes ? notes.trim() : null,
        status: 'OPEN',
      },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Shift kasir berhasil dibuka.',
      data: shift,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Mencatat mutasi kas masuk / kas keluar di laci kasir
 * POST /api/shifts/movement
 * Protected: authenticate, requirePermission('pos:shift')
 */
export const recordCashMovement = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user.id;
    const branchId = req.activeBranchId;
    const { type, amount, reason } = req.body;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang aktif tidak terdeteksi.',
      });
    }

    if (!['CASH_IN', 'CASH_OUT'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipe mutasi kas harus CASH_IN atau CASH_OUT.',
      });
    }

    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Nominal mutasi kas harus lebih dari 0.',
      });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Alasan mutasi kas wajib disertakan.',
      });
    }

    // Cari shift aktif kasir saat ini
    const activeShift = await prisma.cashierShift.findFirst({
      where: {
        tenantId,
        branchId,
        userId,
        status: 'OPEN',
      },
    });

    if (!activeShift) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada shift kasir yang aktif untuk mencatat mutasi kas.',
      });
    }

    const movement = await prisma.cashMovement.create({
      data: {
        shiftId: activeShift.id,
        type,
        amount: parsedAmount,
        reason: reason.trim(),
      },
    });

    return res.status(201).json({
      success: true,
      message: `Mutasi kas (${type === 'CASH_IN' ? 'Kas Masuk' : 'Kas Keluar'}) berhasil dicatat.`,
      data: movement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Menutup shift kasir dan rekonsiliasi laci kas
 * POST /api/shifts/close
 * Protected: authenticate, requirePermission('pos:shift')
 */
export const closeShift = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user.id;
    const branchId = req.activeBranchId;
    const { actualCash, notes = '' } = req.body;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang aktif tidak terdeteksi.',
      });
    }

    if (actualCash === undefined || actualCash === null || isNaN(parseInt(actualCash, 10))) {
      return res.status(400).json({
        success: false,
        message: 'Jumlah uang fisik aktual di laci (actualCash) wajib diisi.',
      });
    }

    const parsedActualCash = Math.max(0, parseInt(actualCash, 10));

    // Cari shift aktif kasir
    const activeShift = await prisma.cashierShift.findFirst({
      where: {
        tenantId,
        branchId,
        userId,
        status: 'OPEN',
      },
      include: {
        movements: true,
      },
    });

    if (!activeShift) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada shift kasir yang aktif untuk ditutup.',
      });
    }

    // Hitung total penjualan tunai dari order shift ini
    const cashOrders = await prisma.order.aggregate({
      where: {
        shiftId: activeShift.id,
        status: 'COMPLETED',
        paymentMethod: 'CASH',
      },
      _sum: {
        totalAmount: true,
      },
    });

    let totalCashIn = 0;
    let totalCashOut = 0;
    activeShift.movements.forEach((m) => {
      if (m.type === 'CASH_IN') totalCashIn += m.amount;
      if (m.type === 'CASH_OUT') totalCashOut += m.amount;
    });

    const totalCashSales = cashOrders._sum.totalAmount || 0;
    const expectedCash = activeShift.startingCash + totalCashSales + totalCashIn - totalCashOut;
    const cashDifference = parsedActualCash - expectedCash;

    const closedShift = await prisma.cashierShift.update({
      where: { id: activeShift.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        actualCash: parsedActualCash,
        expectedCash,
        cashDifference,
        notes: notes ? notes.trim() : activeShift.notes,
      },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        movements: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Shift kasir berhasil ditutup dan direkonsiliasi.',
      data: {
        ...closedShift,
        totalCashSales,
        totalCashIn,
        totalCashOut,
        expectedCash,
        actualCash: parsedActualCash,
        cashDifference,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getCurrentShift,
  openShift,
  recordCashMovement,
  closeShift,
};
