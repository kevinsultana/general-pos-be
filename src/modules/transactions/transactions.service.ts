import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { CompleteTransactionInput, CancelTransactionInput } from './transactions.schemas.js';

export class TransactionsService {
  static async getTransactions(
    storeId: string,
    options?: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { storeId };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options?.startDate) where.createdAt.gte = options.startDate;
      if (options?.endDate) where.createdAt.lte = options.endDate;
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          createdBy: { select: { id: true, username: true, displayName: true } },
          payments: {
            include: {
              paymentMethod: { select: { id: true, name: true, type: true } },
            },
          },
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total, limit, offset };
  }

  static async getTransactionById(storeId: string, transactionId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, storeId },
      include: {
        customer: true,
        createdBy: { select: { id: true, username: true, displayName: true } },
        cancelledBy: { select: { id: true, username: true, displayName: true } },
        promotion: true,
        items: {
          include: {
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, name: true } },
          },
        },
        payments: {
          include: {
            paymentMethod: true,
          },
        },
        refunds: {
          include: {
            items: true,
            createdBy: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    if (!transaction) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Transaksi tidak ditemukan' };
    }

    return transaction;
  }

  static async completeTransaction(
    storeId: string,
    input: CompleteTransactionInput,
    currentUserId: string,
    options?: { allowNegativeStock?: boolean; allowInactiveProducts?: boolean }
  ) {
    const transactionId = input.id || uuidv4();

    // 1. Idempotency Check: if already exists, return existing
    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, storeId },
      include: { items: true, payments: true },
    });

    if (existing) {
      const trx = await this.getTransactionById(storeId, transactionId);
      return { ...trx, isExisting: true };
    }

    // 2. Fetch products and variants to snapshot prices, costs, and names
    const productIds = Array.from(new Set(input.items.map((it) => it.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId },
      include: { variants: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product || (!product.active && !options?.allowInactiveProducts)) {
        throw {
          statusCode: 400,
          code: 'PRODUCT_INACTIVE_OR_NOT_FOUND',
          message: `Produk "${item.productId}" tidak ditemukan atau non-aktif`,
        };
      }
    }

    // 3. Validate Cash Rounding rules (PRD Bab 21 & INV-013) and resolve payment methods
    const isUuid = (str: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

    const resolveAliasType = (methodIdOrType: string): 'CASH' | 'QRIS' | 'TRANSFER' | 'DEBIT' | 'CREDIT' => {
      const lower = (methodIdOrType || '').toLowerCase();
      if (lower.includes('cash') || lower.includes('tunai')) return 'CASH';
      if (lower.includes('qris')) return 'QRIS';
      if (lower.includes('transfer') || lower.includes('trf')) return 'TRANSFER';
      if (lower.includes('credit')) return 'CREDIT';
      if (lower.includes('debit') || lower.includes('card')) return 'DEBIT';
      return 'CASH';
    };

    const validUuidIds = input.payments
      .map((p) => p.paymentMethodId)
      .filter((id) => isUuid(id));

    const existingPaymentMethods = await prisma.paymentMethod.findMany({
      where: { id: { in: validUuidIds }, storeId },
    });
    const pmMap = new Map<string, any>(existingPaymentMethods.map((pm) => [pm.id, pm]));

    // Resolve aliases or unknown IDs to real store PaymentMethod rows
    for (const p of input.payments) {
      let pm = pmMap.get(p.paymentMethodId);
      if (!pm) {
        const targetType = resolveAliasType(
          (p.metadata as any)?.paymentType || p.paymentMethodId || 'CASH'
        );
        pm = await prisma.paymentMethod.findFirst({
          where: { storeId, type: targetType, enabled: true },
        });
        if (!pm) {
          pm = await prisma.paymentMethod.findFirst({
            where: { storeId, type: targetType },
          });
        }
        if (!pm) {
          const defaultName =
            targetType === 'CASH'
              ? 'Tunai'
              : targetType === 'QRIS'
              ? 'QRIS'
              : targetType === 'TRANSFER'
              ? 'Transfer Bank'
              : targetType === 'CREDIT'
              ? 'Kartu Kredit'
              : 'Kartu Debit';
          pm = await prisma.paymentMethod.create({
            data: {
              storeId,
              name: defaultName,
              type: targetType,
              enabled: true,
            },
          });
        }
        pmMap.set(p.paymentMethodId, pm);
        pmMap.set(pm.id, pm);
        p.paymentMethodId = pm.id;
      }

      const paymentType = pm?.type || (p.metadata as any)?.paymentType;
      if (paymentType && paymentType !== 'CASH' && p.roundingAmount && p.roundingAmount !== 0) {
        throw {
          statusCode: 400,
          code: 'INVALID_ROUNDING_AMOUNT',
          message: `Cash rounding hanya berlaku untuk pembayaran CASH, namun metode "${pm?.name || p.paymentMethodId}" (${paymentType}) memiliki roundingAmount: ${p.roundingAmount}`,
        };
      }
    }

    const totalPaymentsRounding = input.payments.reduce((sum, p) => sum + (p.roundingAmount || 0), 0);
    if (input.roundingAmount !== totalPaymentsRounding) {
      throw {
        statusCode: 400,
        code: 'INVALID_ROUNDING_AMOUNT',
        message: `Transaction roundingAmount (${input.roundingAmount}) harus sama dengan akumulasi rounding payments (${totalPaymentsRounding})`,
      };
    }

    // Generate Transaction Number if not provided
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    let transactionNumber =
      input.transactionNumber || `TRX-${datePrefix}-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    // Safety guard against unique constraint collision with another transaction ID
    const conflictingTrx = await prisma.transaction.findFirst({
      where: { storeId, transactionNumber, NOT: { id: transactionId } },
      select: { id: true },
    });
    if (conflictingTrx) {
      transactionNumber = `${transactionNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 4. Execute Atomic DB Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Calculate paidTotal
      const paidTotal = input.payments.reduce((sum, p) => sum + p.amount, 0);

      // Create Transaction
      const trx = await tx.transaction.create({
        data: {
          id: transactionId,
          storeId,
          transactionNumber,
          customerId: input.customerId || null,
          status: 'COMPLETED',
          orderType: input.orderType || null,
          queueNumber: input.queueNumber || null,
          subtotal: input.subtotal,
          discountType: input.discountType || null,
          discountValue: input.discountValue ?? null,
          discountTotal: input.discountTotal,
          roundingAmount: input.roundingAmount,
          total: input.total,
          paidTotal,
          promotionId: input.promotionId || null,
          createdById: currentUserId,
          completedAt: now,
        },
      });

      // Insert Items, Snapshots, and deduct stock
      for (const item of input.items) {
        const product = productMap.get(item.productId)!;
        const variant = item.variantId
          ? product.variants.find((v) => v.id === item.variantId)
          : null;

        const productNameSnapshot = product.name;
        const variantNameSnapshot = variant ? variant.name : null;
        const skuSnapshot = variant ? variant.sku || product.sku : product.sku;
        const barcodeSnapshot = variant ? variant.barcode || product.barcode : product.barcode;
        const unitCostSnapshot = variant ? variant.cost : product.cost;

        // Create transaction item
        await tx.transactionItem.create({
          data: {
            id: item.id || uuidv4(),
            transactionId: trx.id,
            productId: item.productId,
            variantId: item.variantId || null,
            productNameSnapshot,
            variantNameSnapshot,
            skuSnapshot,
            barcodeSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCostSnapshot,
            discountType: item.discountType || null,
            discountValue: item.discountValue ?? null,
            discountAmount: item.discountAmount,
            subtotal: item.subtotal,
            total: item.total,
          },
        });

        // Deduct stock with atomic guard to prevent negative stock (overselling)
        if (item.variantId) {
          const currentVariant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { stock: true },
          });
          if (!options?.allowNegativeStock && (!currentVariant || Number(currentVariant.stock) < item.quantity)) {
            throw {
              statusCode: 409,
              code: 'INSUFFICIENT_STOCK',
              message: `Stok varian "${variantNameSnapshot || item.variantId}" tidak mencukupi (sisa: ${currentVariant?.stock ?? 0}, diminta: ${item.quantity})`,
            };
          }
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          const currentProd = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stock: true },
          });
          if (!options?.allowNegativeStock && (!currentProd || Number(currentProd.stock) < item.quantity)) {
            throw {
              statusCode: 409,
              code: 'INSUFFICIENT_STOCK',
              message: `Stok produk "${productNameSnapshot}" tidak mencukupi (sisa: ${currentProd?.stock ?? 0}, diminta: ${item.quantity})`,
            };
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        // Record stock movement (SALE)
        await tx.stockMovement.create({
          data: {
            storeId,
            productId: item.productId,
            variantId: item.variantId || null,
            type: 'SALE',
            quantityDelta: -item.quantity, // Negative for sale
            unitCost: unitCostSnapshot,
            referenceType: 'TRANSACTION',
            referenceId: trx.id,
            reason: `Penjualan ${trx.transactionNumber}`,
            createdById: currentUserId,
          },
        });
      }

      // Insert Payments
      for (const p of input.payments) {
        await tx.payment.create({
          data: {
            id: p.id || uuidv4(),
            transactionId: trx.id,
            paymentMethodId: p.paymentMethodId,
            amount: p.amount,
            roundingAmount: p.roundingAmount,
            status: 'COMPLETED',
            metadata: p.metadata ?? undefined,
            paidAt: now,
          },
        });
      }

      return trx;
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'COMPLETE_TRANSACTION',
      entityType: 'Transaction',
      entityId: result.id,
      afterData: {
        transactionNumber: result.transactionNumber,
        total: Number(result.total),
        itemCount: input.items.length,
      },
    });

    return this.getTransactionById(storeId, result.id);
  }

  static async cancelTransaction(
    storeId: string,
    transactionId: string,
    input: CancelTransactionInput,
    currentUserId: string
  ) {
    const trx = await prisma.transaction.findFirst({
      where: { id: transactionId, storeId },
      include: { items: true, refunds: true },
    });

    if (!trx) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Transaksi tidak ditemukan' };
    }

    if (trx.status === 'CANCELLED') {
      throw { statusCode: 400, code: 'ALREADY_CANCELLED', message: 'Transaksi ini sudah pernah dibatalkan' };
    }

    if (trx.refunds && trx.refunds.length > 0) {
      throw {
        statusCode: 400,
        code: 'HAS_REFUNDS',
        message: 'Transaksi tidak dapat dibatalkan karena telah memiliki pengembalian dana (refund)',
      };
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Mark transaction as CANCELLED
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledById: currentUserId,
        },
      });

      // 2. Reverse stock for each item
      for (const item of trx.items) {
        const qty = Number(item.quantity);

        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: qty } },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: qty } },
          });
        }

        // Record stock movement (CANCEL_REVERSAL)
        await tx.stockMovement.create({
          data: {
            storeId,
            productId: item.productId,
            variantId: item.variantId || null,
            type: 'CANCEL_REVERSAL',
            quantityDelta: qty, // Positive to restore stock
            unitCost: item.unitCostSnapshot,
            referenceType: 'TRANSACTION_CANCEL',
            referenceId: transactionId,
            reason: `Pembatalan Transaksi ${trx.transactionNumber}: ${input.reason}`,
            createdById: currentUserId,
          },
        });
      }
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'CANCEL_TRANSACTION',
      entityType: 'Transaction',
      entityId: transactionId,
      metadata: { reason: input.reason, transactionNumber: trx.transactionNumber },
    });

    return this.getTransactionById(storeId, transactionId);
  }
}
