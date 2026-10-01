import prisma from '../lib/prisma.js';

/**
 * Helper: Bangun query Where berdasarkan branchId dan tanggal
 */
const buildReportFilter = (req) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, branchId } = req.query;

  const where = { tenantId };

  // Multi-cabang: Jika paket PRO dan branchId === 'all', jangan filter branchId (konsolidasi)
  const isProPlan = req.tenant?.plan === 'PRO';
  if (branchId && branchId === 'all' && isProPlan) {
    // Konsolidasi seluruh cabang
  } else if (branchId && branchId !== 'all') {
    where.branchId = branchId;
  } else if (req.activeBranchId) {
    where.branchId = req.activeBranchId;
  }

  // Filter Tanggal
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  return where;
};

/**
 * Controller: Mendapatkan ringkasan metrik finansial riil (Omzet, HPP, Laba Kotor, Biaya, Laba Bersih)
 * GET /api/reports/summary
 * Protected: authenticate, requirePermission('reports:view')
 */
export const getFinancialSummary = async (req, res, next) => {
  try {
    const orderWhere = {
      ...buildReportFilter(req),
      status: 'COMPLETED',
    };

    // Filter untuk Expense
    const expenseWhere = { tenantId: req.tenantId };
    if (orderWhere.branchId) expenseWhere.branchId = orderWhere.branchId;
    if (req.query.startDate || req.query.endDate) {
      expenseWhere.expenseDate = {};
      if (req.query.startDate) expenseWhere.expenseDate.gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        expenseWhere.expenseDate.lte = end;
      }
    }

    // 1. Ambil agregat Order
    const [orderAggregate, completedOrders, totalExpensesAggregate] = await Promise.all([
      prisma.order.aggregate({
        where: orderWhere,
        _sum: {
          totalAmount: true,
          discount: true,
          tax: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.order.findMany({
        where: orderWhere,
        include: {
          items: {
            include: {
              product: {
                select: { cogs: true },
              },
            },
          },
        },
      }),
      prisma.expense.aggregate({
        where: expenseWhere,
        _sum: {
          amount: true,
        },
      }),
    ]);

    const grossSales = orderAggregate._sum.totalAmount || 0;
    const totalDiscounts = orderAggregate._sum.discount || 0;
    const totalTax = orderAggregate._sum.tax || 0;
    const totalTransactions = orderAggregate._count.id || 0;
    const avgTicketSize = totalTransactions > 0 ? Math.round(grossSales / totalTransactions) : 0;
    const totalExpenses = totalExpensesAggregate._sum.amount || 0;

    // 2. Hitung COGS / HPP (Harga Pokok Penjualan) dari item yang terjual
    let totalCogs = 0;
    const paymentMap = {
      CASH: { count: 0, total: 0 },
      QRIS: { count: 0, total: 0 },
      TRANSFER: { count: 0, total: 0 },
      DEBIT: { count: 0, total: 0 },
    };

    completedOrders.forEach((order) => {
      // Payment Breakdown
      const method = order.paymentMethod || 'CASH';
      if (!paymentMap[method]) paymentMap[method] = { count: 0, total: 0 };
      paymentMap[method].count += 1;
      paymentMap[method].total += order.totalAmount;

      // Hitung modal produk
      order.items.forEach((item) => {
        const itemCogs = item.product?.cogs || 0;
        totalCogs += Math.round(item.quantity * itemCogs);
      });
    });

    const grossProfit = grossSales - totalCogs;
    const netProfit = grossProfit - totalExpenses;

    return res.status(200).json({
      success: true,
      data: {
        grossSales,
        totalDiscounts,
        totalTax,
        totalTransactions,
        avgTicketSize,
        cogs: totalCogs,
        grossProfit,
        totalExpenses,
        netProfit,
        paymentBreakdown: paymentMap,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Mendapatkan data deret waktu omzet dan laba harian untuk grafik
 * GET /api/reports/sales-chart
 * Protected: authenticate, requirePermission('reports:view')
 */
export const getSalesChart = async (req, res, next) => {
  try {
    const orderWhere = {
      ...buildReportFilter(req),
      status: 'COMPLETED',
    };

    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        totalAmount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Kelompokkan data per tanggal (YYYY-MM-DD)
    const groupedDays = {};

    orders.forEach((o) => {
      const dateKey = o.createdAt.toISOString().split('T')[0];
      if (!groupedDays[dateKey]) {
        groupedDays[dateKey] = {
          date: dateKey,
          sales: 0,
          orders: 0,
        };
      }
      groupedDays[dateKey].sales += o.totalAmount;
      groupedDays[dateKey].orders += 1;
    });

    const chartData = Object.values(groupedDays).sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Top 5 produk terlaris berdasarkan kuantitas & kontribusi omzet
 * GET /api/reports/top-products
 * Protected: authenticate, requirePermission('reports:view')
 */
export const getTopProducts = async (req, res, next) => {
  try {
    const orderWhere = {
      ...buildReportFilter(req),
      status: 'COMPLETED',
    };

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: orderWhere,
      },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        subtotal: true,
      },
    });

    const productMap = {};

    orderItems.forEach((item) => {
      if (!productMap[item.productId]) {
        productMap[item.productId] = {
          productId: item.productId,
          name: item.productName,
          totalQty: 0,
          totalRevenue: 0,
        };
      }
      productMap[item.productId].totalQty += item.quantity;
      productMap[item.productId].totalRevenue += item.subtotal;
    });

    const topList = Object.values(productMap)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      data: topList,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Ekspor data laporan keuangan & rekapan penjualan format CSV/JSON
 * GET /api/reports/export
 * Protected: authenticate, requirePermission('reports:export')
 */
export const exportReportData = async (req, res, next) => {
  try {
    const orderWhere = {
      ...buildReportFilter(req),
      status: 'COMPLETED',
    };

    const orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        branch: { select: { name: true } },
        cashier: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const exportRows = orders.map((o) => ({
      orderNumber: o.orderNumber,
      date: o.createdAt.toISOString(),
      branch: o.branch?.name || '-',
      cashier: o.cashier?.name || '-',
      customerName: o.customerName || '-',
      paymentMethod: o.paymentMethod,
      itemCount: o.items.length,
      subtotal: o.subtotal,
      discount: o.discount,
      tax: o.tax,
      totalAmount: o.totalAmount,
    }));

    return res.status(200).json({
      success: true,
      data: exportRows,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getFinancialSummary,
  getSalesChart,
  getTopProducts,
  exportReportData,
};
