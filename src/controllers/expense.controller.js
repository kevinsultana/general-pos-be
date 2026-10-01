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
 * Controller: Mendapatkan daftar kategori pengeluaran operasional
 * GET /api/expenses/categories
 * Protected: authenticate, requirePermission('reports:view')
 */
export const getExpenseCategories = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const categories = await prisma.expenseCategory.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Membuat kategori beban pengeluaran baru
 * POST /api/expenses/categories
 * Protected: authenticate, requirePermission('reports:view')
 */
export const createExpenseCategory = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama kategori biaya wajib diisi.',
      });
    }

    const category = await prisma.expenseCategory.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: name.trim(),
        },
      },
      update: {},
      create: {
        tenantId,
        name: name.trim(),
        isSystem: false,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Kategori pengeluaran berhasil dibuat.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Mendapatkan daftar pengeluaran operasional dengan filter & paginasi
 * GET /api/expenses
 * Protected: authenticate, requirePermission('reports:view')
 */
export const getExpenses = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      branchId,
      categoryId,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const where = { tenantId };

    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    } else if (!branchId && req.activeBranchId) {
      where.branchId = req.activeBranchId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    const [expenses, totalCount, aggregate] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: parsedLimit,
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: expenses,
      totalExpenseAmount: aggregate._sum.amount || 0,
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
 * Controller: Mencatat transaksi pengeluaran operasional baru
 * POST /api/expenses
 * Protected: authenticate, requirePermission('reports:view')
 */
export const createExpense = async (req, res, next) => {
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
      categoryId,
      amount,
      expenseDate,
      recipient = null,
      notes = null,
      receiptUrl = null,
    } = req.body;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Kategori biaya wajib dipilih.',
      });
    }

    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Nominal pengeluaran harus lebih dari 0.',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    const dateStr = getFormattedDateString();
    const randomSuffix = crypto.randomInt(1000, 9999);
    const expenseNo = `EXP-${tenant?.slug?.toUpperCase() || 'POS'}-${dateStr}-${randomSuffix}`;

    const expense = await prisma.expense.create({
      data: {
        expenseNo,
        tenantId,
        branchId,
        categoryId,
        userId,
        amount: parsedAmount,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        recipient: recipient ? recipient.trim() : null,
        notes: notes ? notes.trim() : null,
        receiptUrl: receiptUrl || null,
      },
      include: {
        category: true,
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Pengeluaran operasional berhasil dicatat.',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Memperbarui data pengeluaran
 * PUT /api/expenses/:id
 * Protected: authenticate, requirePermission('reports:view')
 */
export const updateExpense = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const {
      categoryId,
      amount,
      expenseDate,
      recipient,
      notes,
      receiptUrl,
    } = req.body;

    const existing = await prisma.expense.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Data pengeluaran tidak ditemukan.',
      });
    }

    const updateData = {};
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (amount !== undefined) updateData.amount = Math.max(1, parseInt(amount, 10) || 1);
    if (expenseDate !== undefined) updateData.expenseDate = new Date(expenseDate);
    if (recipient !== undefined) updateData.recipient = recipient ? recipient.trim() : null;
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;
    if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl || null;

    const updated = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        branch: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Data pengeluaran berhasil diperbarui.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Menghapus catatan pengeluaran
 * DELETE /api/expenses/:id
 * Protected: authenticate, requirePermission('reports:view')
 */
export const deleteExpense = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const existing = await prisma.expense.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Catatan pengeluaran tidak ditemukan.',
      });
    }

    await prisma.expense.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Catatan pengeluaran berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getExpenseCategories,
  createExpenseCategory,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};
