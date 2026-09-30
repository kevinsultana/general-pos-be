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

    let variant: any = null;
    if (input.variantId) {
      variant = product.variants.find((v) => v.id === input.variantId);
      if (!variant) {
        throw { statusCode: 404, code: 'NOT_FOUND', message: 'Varian produk tidak ditemukan' };
      }
    }

    // Hitung Weighted Average Cost (WAC) jika tipe STOCK_IN dan unitCost disertakan
    // Rumus PRD / AGENTS.md § 13.2:
    // WAC = ((currentStock * currentCost) + (incomingQty * incomingUnitCost)) / (currentStock + incomingQty)
    let calculatedCost: number | undefined;
    if (input.type === 'STOCK_IN' && input.unitCost !== undefined) {
      const incomingQty = Math.abs(input.quantityDelta);
      const incomingUnitCost = input.unitCost;
      const targetEntity = variant || product;
      const currentStock = Number(targetEntity.stock);
      const currentCost = Number(targetEntity.cost);

      if (currentStock <= 0) {
        calculatedCost = incomingUnitCost;
      } else {
        const totalQty = currentStock + incomingQty;
        calculatedCost =
          totalQty > 0
            ? Number(
                (
                  (currentStock * currentCost + incomingQty * incomingUnitCost) /
                  totalQty
                ).toFixed(2)
              )
            : incomingUnitCost;
      }
    }

    const movement = await prisma.$transaction(async (tx) => {
      // 1. Update product or variant stock and cost
      if (input.variantId) {
        await tx.productVariant.update({
          where: { id: input.variantId },
          data: {
            stock: {
              increment: input.quantityDelta,
            },
            ...(calculatedCost !== undefined ? { cost: calculatedCost } : {}),
          },
        });
      } else {
        await tx.product.update({
          where: { id: input.productId },
          data: {
            stock: {
              increment: input.quantityDelta,
            },
            ...(calculatedCost !== undefined ? { cost: calculatedCost } : {}),
          },
        });
      }

      // 2. Create StockMovement record
      return tx.stockMovement.create({
        data: {
          id: (input as any).id || undefined,
          storeId,
          productId: input.productId,
          variantId: input.variantId || null,
          type: input.type,
          quantityDelta: input.quantityDelta,
          unitCost: input.unitCost || null,
          reason: input.reason,
          createdById: currentUserId,
          createdAt: (input as any).createdAt ? new Date((input as any).createdAt) : undefined,
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
        variant: variant?.name,
        type: input.type,
        delta: input.quantityDelta,
        unitCost: input.unitCost,
        newCost: calculatedCost,
        reason: input.reason,
      },
    });

    return movement;
  }
}
