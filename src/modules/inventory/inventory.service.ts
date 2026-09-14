import { prisma } from '../../config/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateStockMovementInput } from './inventory.schemas.js';

export class InventoryService {
  static async getStockMovements(
    storeId: string,
    options?: {
      productId?: string;
      variantId?: string;
      limit?: number;
    }
  ) {
    const limit = options?.limit ?? 100;
    return prisma.stockMovement.findMany({
      where: {
        storeId,
        ...(options?.productId ? { productId: options.productId } : {}),
        ...(options?.variantId ? { variantId: options.variantId } : {}),
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  static async adjustStock(
    storeId: string,
    input: CreateStockMovementInput,
    currentUserId: string
  ) {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, storeId },
      include: { variants: true },
    });

    if (!product) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
    }

    if (input.variantId) {
      const variant = product.variants.find((v) => v.id === input.variantId);
      if (!variant) {
        throw { statusCode: 404, code: 'NOT_FOUND', message: 'Varian produk tidak ditemukan' };
      }
    }

    const movement = await prisma.$transaction(async (tx) => {
      // 1. Update product or variant stock
      if (input.variantId) {
        await tx.productVariant.update({
          where: { id: input.variantId },
          data: {
            stock: {
              increment: input.quantityDelta,
            },
          },
        });
      } else {
        await tx.product.update({
          where: { id: input.productId },
          data: {
            stock: {
              increment: input.quantityDelta,
            },
            // If STOCK_IN and unitCost provided, update product cost
            ...(input.type === 'STOCK_IN' && input.unitCost !== undefined
              ? { cost: input.unitCost }
              : {}),
          },
        });
      }

      // 2. Create StockMovement record
      return tx.stockMovement.create({
        data: {
          storeId,
          productId: input.productId,
          variantId: input.variantId || null,
          type: input.type,
          quantityDelta: input.quantityDelta,
          unitCost: input.unitCost || null,
          reason: input.reason,
          createdById: currentUserId,
        },
        include: {
          product: { select: { id: true, name: true } },
          variant: { select: { id: true, name: true } },
        },
      });
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'ADJUST_STOCK',
      entityType: 'StockMovement',
      entityId: movement.id,
      afterData: {
        product: product.name,
        type: input.type,
        delta: input.quantityDelta,
        reason: input.reason,
      },
    });

    return movement;
  }
}
