import { prisma } from '../../config/prisma.js';

export class ReportsService {
  /**
   * Laporan Penjualan (Sales Report)
   * Menyajikan ringkasan omzet kotor, diskon, penjualan bersih, estimasi laba kotor HPP,
   * pembatalan, refund, dan persebaran metode pembayaran dalam rentang tanggal.
   */
  static async getSalesReport(
    storeId: string,
    filter?: { startDate?: string; endDate?: string }
  ) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (filter?.startDate) {
      dateFilter.gte = new Date(filter.startDate);
    }
    if (filter?.endDate) {
      // Inklusi akhir hari jika hanya tanggal (YYYY-MM-DD)
      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const whereDate = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const [
      completedTransactions,
      cancelledCount,
      refundCount,
      refunds,
      paymentsRaw,
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          storeId,
          status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          ...whereDate,
        },
        include: {
          items: {
            select: {
              total: true,
              quantity: true,
              unitCostSnapshot: true,
            },
          },
        },
      }),
      prisma.transaction.count({
        where: { storeId, status: 'CANCELLED', ...whereDate },
      }),
      prisma.transaction.count({
        where: { storeId, status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] }, ...whereDate },
      }),
      prisma.refund.aggregate({
        where: { transaction: { storeId }, ...whereDate },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.groupBy({
        by: ['paymentMethodId'],
        where: {
          transaction: {
            storeId,
            status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
            ...whereDate,
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    let grossSales = 0;
    let discountTotal = 0;
    let netSales = 0;
    let totalCost = 0;

    for (const trx of completedTransactions) {
      grossSales += Number(trx.subtotal);
      discountTotal += Number(trx.discountTotal);
      netSales += Number(trx.total);

      for (const it of trx.items) {
        totalCost += Number(it.unitCostSnapshot) * Number(it.quantity);
      }
    }

    const grossProfit = netSales - totalCost;
    const totalRefundAmount = Number(refunds._sum.amount ?? 0);

    // Ambil nama metode pembayaran
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { storeId },
      select: { id: true, name: true, type: true },
    });
    const paymentMethodMap = new Map(paymentMethods.map((pm) => [pm.id, pm.name]));

    const paymentBreakdown = paymentsRaw.map((p) => ({
      paymentMethodId: p.paymentMethodId,
      name: paymentMethodMap.get(p.paymentMethodId) || 'Lainnya',
      amount: Number(p._sum.amount ?? 0),
      count: p._count.id,
    }));

    return {
      period: {
        startDate: filter?.startDate || null,
        endDate: filter?.endDate || null,
      },
      metrics: {
        grossSales,
        discountTotal,
        netSales,
        grossProfit,
        profitMarginPercentage: netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(2)) : 0,
        totalRefundAmount,
      },
      counts: {
        completed: completedTransactions.length,
        cancelled: cancelledCount,
        refunded: refundCount,
        refundEvents: refunds._count.id,
      },
      paymentBreakdown,
    };
  }

  /**
   * Laporan Performa Produk (Product Performance Report)
   * Menyajikan barang terlaris, unit terjual, pendapatan kotor, total modal HPP snapshot,
   * dan laba kotor per produk.
   */
  static async getProductPerformanceReport(
    storeId: string,
    filter?: { startDate?: string; endDate?: string; limit?: number }
  ) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (filter?.startDate) {
      dateFilter.gte = new Date(filter.startDate);
    }
    if (filter?.endDate) {
      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    const whereDate = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const items = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          storeId,
          status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          ...whereDate,
        },
      },
      select: {
        productNameSnapshot: true,
        variantNameSnapshot: true,
        quantity: true,
        total: true,
        unitCostSnapshot: true,
      },
    });

    const productMap = new Map<
      string,
      {
        name: string;
        variantName?: string | null;
        quantitySold: number;
        revenue: number;
        cost: number;
      }
    >();

    for (const it of items) {
      const key = `${it.productNameSnapshot}__${it.variantNameSnapshot || ''}`;
      const existing = productMap.get(key) || {
        name: it.productNameSnapshot,
        variantName: it.variantNameSnapshot,
        quantitySold: 0,
        revenue: 0,
        cost: 0,
      };

      const qty = Number(it.quantity);
      const rev = Number(it.total);
      const c = Number(it.unitCostSnapshot) * qty;

      existing.quantitySold += qty;
      existing.revenue += rev;
      existing.cost += c;

      productMap.set(key, existing);
    }

    const performance = Array.from(productMap.values()).map((p) => {
      const grossProfit = p.revenue - p.cost;
      const marginPercentage = p.revenue > 0 ? Number(((grossProfit / p.revenue) * 100).toFixed(2)) : 0;
      return {
        ...p,
        grossProfit,
        marginPercentage,
      };
    });

    // Urutkan dari kuantitas terjual terbanyak
    performance.sort((a, b) => b.quantitySold - a.quantitySold);

    const limit = filter?.limit || 50;
    return performance.slice(0, limit);
  }

  /**
   * Laporan Inventori (Inventory Report)
   * Valuasi modal stok berjalan, produk menipis, produk stok negatif, dan ringkasan mutasi.
   */
  static async getInventoryReport(storeId: string) {
    const products = await prisma.product.findMany({
      where: { storeId, active: true },
      include: {
        variants: { where: { active: true } },
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    let totalValuation = 0;
    let totalItemsTracked = 0;
    const lowStockItems: any[] = [];
    const negativeStockItems: any[] = [];

    for (const p of products) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          const stock = Number(v.stock);
          const cost = Number(v.cost);
          const threshold = Number(v.lowStockThreshold);

          totalValuation += stock > 0 ? stock * cost : 0;
          totalItemsTracked++;

          if (stock <= threshold) {
            lowStockItems.push({
              productId: p.id,
              variantId: v.id,
              name: `${p.name} - ${v.name}`,
              sku: v.sku || p.sku,
              stock,
              threshold,
              cost,
              category: p.category?.name || 'Umum',
            });
          }

          if (stock < 0) {
            negativeStockItems.push({
              productId: p.id,
              variantId: v.id,
              name: `${p.name} - ${v.name}`,
              stock,
              cost,
              category: p.category?.name || 'Umum',
            });
          }
        }
      } else {
        const stock = Number(p.stock);
        const cost = Number(p.cost);
        const threshold = Number(p.lowStockThreshold);

        totalValuation += stock > 0 ? stock * cost : 0;
        totalItemsTracked++;

        if (stock <= threshold) {
          lowStockItems.push({
            productId: p.id,
            name: p.name,
            sku: p.sku,
            stock,
            threshold,
            cost,
            category: p.category?.name || 'Umum',
          });
        }

        if (stock < 0) {
          negativeStockItems.push({
            productId: p.id,
            name: p.name,
            stock,
            cost,
            category: p.category?.name || 'Umum',
          });
        }
      }
    }

    return {
      summary: {
        totalItemsTracked,
        totalValuation,
        lowStockCount: lowStockItems.length,
        negativeStockCount: negativeStockItems.length,
      },
      lowStockItems,
      negativeStockItems,
    };
  }
}
