import prisma from '../lib/prisma.js';

/**
 * GET /api/shifts/active
 * Cek apakah ada shift OPEN untuk user di branch aktif saat ini
 */
export const getActiveShift = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;
    const userId = req.user.id;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang aktif tidak ditemukan. Silakan pilih cabang terlebih dahulu.',
      });
    }

    const activeShift = await prisma.shift.findFirst({
      where: {
        tenantId,
        branchId,
        userId,
        status: 'OPEN',
      },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: activeShift || null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/shifts
 * Buka shift baru (harus belum ada shift OPEN di branch yang sama untuk user ini)
 */
export const openShift = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;
    const userId = req.user.id;
    const { startingCash } = req.body;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang aktif tidak ditemukan. Silakan pilih cabang terlebih dahulu.',
      });
    }

    // Cek apakah sudah ada shift terbuka
    const existingOpenShift = await prisma.shift.findFirst({
      where: { tenantId, branchId, userId, status: 'OPEN' },
    });

    if (existingOpenShift) {
      return res.status(409).json({
        success: false,
        message: 'Masih ada shift yang sedang berjalan. Tutup shift saat ini sebelum membuka yang baru.',
        data: existingOpenShift,
      });
    }

    const shift = await prisma.shift.create({
      data: {
        tenantId,
        branchId,
        userId,
        startingCash: parseFloat(startingCash) || 0,
        status: 'OPEN',
      },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Shift berhasil dibuka.',
      data: shift,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/shifts/:id/close
 * Tutup shift aktif dan catat uang akhir
 */
export const closeShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.id;
    const { endingCash } = req.body;

    const shift = await prisma.shift.findFirst({
      where: { id, tenantId, userId, status: 'OPEN' },
    });

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift tidak ditemukan atau sudah ditutup.',
      });
    }

    // Hitung total penjualan dalam shift ini
    const totalSalesAgg = await prisma.transaction.aggregate({
      where: { shiftId: id },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        status: 'CLOSED',
        endTime: new Date(),
        endingCash: parseFloat(endingCash) || null,
      },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Shift berhasil ditutup.',
      data: {
        ...updated,
        summary: {
          totalTransactions: totalSalesAgg._count.id,
          totalSales: totalSalesAgg._sum.totalAmount || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/shifts
 * Riwayat shift dengan filter status, pagination, dan ringkasan per shift
 */
export const getShifts = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;
    const { status, page = 1, limit = 20 } = req.query;

    const where = { tenantId };
    if (branchId) where.branchId = branchId;
    if (status === 'OPEN' || status === 'CLOSED') where.status = status;

    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          _count: { select: { transactions: true } },
        },
        orderBy: { startTime: 'desc' },
        take,
        skip,
      }),
      prisma.shift.count({ where }),
    ]);

    // Ambil agregat transaksi untuk setiap shift sekaligus
    const shiftIds = shifts.map((s) => s.id);
    const aggResults = await prisma.transaction.groupBy({
      by: ['shiftId'],
      where: { shiftId: { in: shiftIds } },
      _sum: { totalAmount: true, totalCost: true },
      _count: { id: true },
    });

    const aggMap = Object.fromEntries(aggResults.map((r) => [r.shiftId, r]));

    const shiftsWithSummary = shifts.map((shift) => {
      const agg = aggMap[shift.id] || {};
      const revenue = parseFloat(agg._sum?.totalAmount || 0);
      const cost = parseFloat(agg._sum?.totalCost || 0);
      return {
        ...shift,
        summary: {
          totalTransactions: agg._count?.id || 0,
          totalRevenue: revenue,
          totalCost: cost,
          totalProfit: revenue - cost,
        },
      };
    });

    return res.status(200).json({
      success: true,
      data: shiftsWithSummary,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
};
