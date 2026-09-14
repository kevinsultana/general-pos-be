import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export class DashboardController {
  static async getSummary(req: Request, res: Response) {
    const storeId = req.user!.storeId;

    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Run parallel aggregations
      const [
        storeInfo,
        totalSalesData,
        todaySalesData,
        monthSalesData,
        completedCount,
        cancelledCount,
        topProductsRaw,
        paymentsRaw,
        lowStockProducts,
        recentTransactions,
      ] = await Promise.all([
        // 1. Store & plan
        prisma.store.findUnique({
          where: { id: storeId },
          select: { name: true, subscriptionPlan: true, subscriptionStatus: true },
        }),

        // 2. All-time revenue
        prisma.transaction.aggregate({
          where: { storeId, status: 'COMPLETED' },
          _sum: { total: true },
          _count: { id: true },
        }),

        // 3. Today's revenue
        prisma.transaction.aggregate({
          where: { storeId, status: 'COMPLETED', createdAt: { gte: startOfToday } },
          _sum: { total: true },
          _count: { id: true },
        }),

        // 4. This month's revenue
        prisma.transaction.aggregate({
          where: { storeId, status: 'COMPLETED', createdAt: { gte: startOfMonth } },
          _sum: { total: true },
          _count: { id: true },
        }),

        // 5. Total count completed
        prisma.transaction.count({ where: { storeId, status: 'COMPLETED' } }),

        // 6. Total count cancelled
        prisma.transaction.count({ where: { storeId, status: 'CANCELLED' } }),

        // 7. Top 5 selling items
        prisma.transactionItem.groupBy({
          by: ['productNameSnapshot'],
          where: { transaction: { storeId, status: 'COMPLETED' } },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        }),

        // 8. Payment breakdown
        prisma.payment.groupBy({
          by: ['paymentMethodId'],
          where: { transaction: { storeId, status: 'COMPLETED' } },
          _sum: { amount: true },
          _count: { id: true },
        }),

        // 9. Low stock alerts (products where stock <= lowStockThreshold and active)
        prisma.product.findMany({
          where: {
            storeId,
            active: true,
            stock: { lte: 5 }, // Default alert threshold
          },
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
            sellingPrice: true,
            category: { select: { name: true } },
          },
          take: 5,
        }),

        // 10. Recent 5 transactions
        prisma.transaction.findMany({
          where: { storeId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            transactionNumber: true,
            status: true,
            total: true,
            createdAt: true,
            createdBy: { select: { displayName: true } },
          },
        }),
      ]);

      // Map payment methods to human names
      const paymentMethods = await prisma.paymentMethod.findMany({
        where: { storeId },
        select: { id: true, name: true, type: true },
      });
      const paymentMethodMap = new Map(paymentMethods.map((pm) => [pm.id, pm.name]));

      const paymentBreakdown = paymentsRaw.map((p) => ({
        paymentMethodId: p.paymentMethodId,
        paymentMethodName: paymentMethodMap.get(p.paymentMethodId) || 'Lainnya',
        totalAmount: Number(p._sum.amount ?? 0),
        transactionCount: p._count.id,
      }));

      const topProducts = topProductsRaw.map((p) => ({
        name: p.productNameSnapshot,
        totalQuantity: Number(p._sum.quantity ?? 0),
        totalRevenue: Number(p._sum.total ?? 0),
      }));

      // Calculate gross profit estimate (Revenue - Cost of items)
      const costAgg = await prisma.transactionItem.aggregate({
        where: { transaction: { storeId, status: 'COMPLETED' } },
        _sum: { subtotal: true },
      });

      const totalRevenue = Number(totalSalesData._sum.total ?? 0);
      const todayRevenue = Number(todaySalesData._sum.total ?? 0);
      const monthRevenue = Number(monthSalesData._sum.total ?? 0);

      const summary = {
        store: storeInfo,
        revenue: {
          allTime: totalRevenue,
          today: todayRevenue,
          thisMonth: monthRevenue,
        },
        transactions: {
          total: (completedCount + cancelledCount),
          completed: completedCount,
          cancelled: cancelledCount,
          todayCount: todaySalesData._count.id,
        },
        topProducts,
        paymentBreakdown,
        lowStockProducts: lowStockProducts.map((p) => ({
          ...p,
          stock: Number(p.stock),
          sellingPrice: Number(p.sellingPrice),
        })),
        recentTransactions: recentTransactions.map((t) => ({
          ...t,
          total: Number(t.total),
        })),
      };

      return sendSuccess(res, summary, 'Ringkasan data dashboard berhasil dimuat');
    } catch (error: any) {
      return sendError(res, 'INTERNAL_SERVER_ERROR', error.message || 'Gagal memuat ringkasan dashboard', 500);
    }
  }
}
