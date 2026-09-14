import { prisma } from '../../config/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateRefundInput } from './refunds.schemas.js';

export class RefundsService {
  static async getRefunds(storeId: string, transactionId: string) {
    return prisma.refund.findMany({
      where: {
        transactionId,
        transaction: { storeId },
      },
      include: {
        items: {
          include: {
            transactionItem: true,
          },
        },
        createdBy: {
          select: { id: true, username: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createRefund(
    storeId: string,
    transactionId: string,
    input: CreateRefundInput,
    currentUserId: string
  ) {
    const trx = await prisma.transaction.findFirst({
      where: { id: transactionId, storeId },
      include: { items: true, refunds: { include: { items: true } } },
    });

    if (!trx) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Transaksi tidak ditemukan' };
    }

    if (trx.status === 'CANCELLED') {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: 'Transaksi yang telah dibatalkan tidak dapat direfund' };
    }

    if (trx.status === 'REFUNDED') {
      throw { statusCode: 400, code: 'ALREADY_FULL_REFUNDED', message: 'Transaksi ini telah direfund secara penuh' };
    }

    const itemMap = new Map(trx.items.map((it) => [it.id, it]));

    // Validate refund quantities against previous refunds
    const previouslyRefundedQty = new Map<string, number>();
    for (const ref of trx.refunds) {
      for (const refItem of ref.items) {
        const prev = previouslyRefundedQty.get(refItem.transactionItemId) || 0;
        previouslyRefundedQty.set(refItem.transactionItemId, prev + Number(refItem.quantity));
      }
    }

    let totalRefundAmount = 0;

    for (const item of input.items) {
      const origItem = itemMap.get(item.transactionItemId);
      if (!origItem) {
        throw { statusCode: 400, code: 'INVALID_ITEM', message: `Item transaksi ${item.transactionItemId} tidak valid` };
      }

      const prevQty = previouslyRefundedQty.get(item.transactionItemId) || 0;
      const remainingQty = Number(origItem.quantity) - prevQty;

      if (item.quantity > remainingQty) {
        throw {
          statusCode: 400,
          code: 'EXCEEDS_REMAINING_QTY',
          message: `Kuantitas refund (${item.quantity}) melebihi sisa item (${remainingQty}) untuk ${origItem.productNameSnapshot}`,
        };
      }

      totalRefundAmount += item.amount;
    }

    const now = new Date();

    const refund = await prisma.$transaction(async (tx) => {
      // 1. Create Refund Record
      const createdRefund = await tx.refund.create({
        data: {
          transactionId,
          amount: totalRefundAmount,
          reason: input.reason,
          status: 'COMPLETED',
          createdById: currentUserId,
          items: {
            create: input.items.map((it) => ({
              transactionItemId: it.transactionItemId,
              quantity: it.quantity,
              amount: it.amount,
            })),
          },
        },
        include: { items: true },
      });

      // 2. Restore stock for refunded items (REFUND_REVERSAL)
      for (const refItem of input.items) {
        const origItem = itemMap.get(refItem.transactionItemId)!;

        if (origItem.variantId) {
          await tx.productVariant.update({
            where: { id: origItem.variantId },
            data: { stock: { increment: refItem.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: origItem.productId },
            data: { stock: { increment: refItem.quantity } },
          });
        }

        await tx.stockMovement.create({
          data: {
            storeId,
            productId: origItem.productId,
            variantId: origItem.variantId || null,
            type: 'REFUND_REVERSAL',
            quantityDelta: refItem.quantity, // Positive to restore stock
            unitCost: origItem.unitCostSnapshot,
            referenceType: 'TRANSACTION_REFUND',
            referenceId: createdRefund.id,
            reason: `Refund Transaksi ${trx.transactionNumber}: ${input.reason}`,
            createdById: currentUserId,
          },
        });
      }

      // 3. Update Transaction status
      // Calculate if total items or total amount equals transaction total
      const totalRefundedSoFar = trx.refunds.reduce((sum, r) => sum + Number(r.amount), 0) + totalRefundAmount;
      const isFullRefund = totalRefundedSoFar >= Number(trx.total);

      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          refundedAt: now,
        },
      });

      return createdRefund;
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'REFUND_TRANSACTION',
      entityType: 'Refund',
      entityId: refund.id,
      metadata: {
        transactionNumber: trx.transactionNumber,
        amount: totalRefundAmount,
        reason: input.reason,
      },
    });

    return refund;
  }
}
