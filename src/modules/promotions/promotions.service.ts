import { prisma } from '../../config/prisma.js';
import { CreatePromotionInput, UpdatePromotionInput, ValidatePromoCodeInput } from './promotions.schemas.js';

export class PromotionsService {
  static async getPromotions(storeId: string, activeOnly?: boolean) {
    const where: any = { storeId };
    if (activeOnly) {
      where.active = true;
    }

    return prisma.promotion.findMany({
      where,
      include: {
        codes: true,
        conditions: true,
        products: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getPromotionById(storeId: string, promotionId: string) {
    const promo = await prisma.promotion.findFirst({
      where: { id: promotionId, storeId },
      include: {
        codes: true,
        conditions: true,
        products: {
          include: { product: true },
        },
      },
    });

    if (!promo) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Promosi tidak ditemukan' };
    }

    return promo;
  }

  static async createPromotion(storeId: string, input: CreatePromotionInput) {
    return prisma.$transaction(async (tx) => {
      const promo = await tx.promotion.create({
        data: {
          storeId,
          name: input.name,
          description: input.description,
          type: input.type,
          value: input.value,
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          minimumPurchase: input.minimumPurchase ?? null,
          active: input.active,
        },
      });

      if (input.code) {
        await tx.promotionCode.create({
          data: {
            storeId,
            promotionId: promo.id,
            code: input.code.toUpperCase(),
            active: true,
          },
        });
      }

      return promo;
    });
  }

  static async updatePromotion(storeId: string, promotionId: string, input: UpdatePromotionInput) {
    const existing = await prisma.promotion.findFirst({
      where: { id: promotionId, storeId },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Promosi tidak ditemukan' };
    }

    return prisma.promotion.update({
      where: { id: promotionId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.startAt ? { startAt: new Date(input.startAt) } : {}),
        ...(input.endAt ? { endAt: new Date(input.endAt) } : {}),
        ...(input.minimumPurchase !== undefined ? { minimumPurchase: input.minimumPurchase } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
  }

  static async validatePromoCode(storeId: string, input: ValidatePromoCodeInput) {
    const normalizedCode = input.code.trim().toUpperCase();

    const promoCode = await prisma.promotionCode.findFirst({
      where: {
        storeId,
        code: normalizedCode,
        active: true,
      },
      include: {
        promotion: true,
      },
    });

    if (!promoCode || !promoCode.promotion) {
      return { valid: false, message: 'Kode voucher tidak ditemukan atau tidak aktif' };
    }

    const promo = promoCode.promotion;
    const now = new Date();

    if (!promo.active) {
      return { valid: false, message: 'Promosi saat ini tidak aktif' };
    }

    if (now < promo.startAt) {
      return { valid: false, message: 'Promosi belum dimulai' };
    }

    if (now > promo.endAt) {
      return { valid: false, message: 'Promosi telah berakhir' };
    }

    if (promoCode.expiresAt && now > promoCode.expiresAt) {
      return { valid: false, message: 'Kode voucher telah kedaluwarsa' };
    }

    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
      return { valid: false, message: 'Batas penggunaan kupon telah habis' };
    }

    if (promo.minimumPurchase && input.subtotal < Number(promo.minimumPurchase)) {
      return {
        valid: false,
        message: `Minimal belanja Rp ${Number(promo.minimumPurchase).toLocaleString('id-ID')} untuk menggunakan voucher ini`,
      };
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (promo.type === 'PERCENTAGE') {
      discountAmount = Math.round((input.subtotal * Number(promo.value)) / 100);
    } else {
      discountAmount = Number(promo.value);
    }

    // Clamp discount to subtotal
    if (discountAmount > input.subtotal) {
      discountAmount = input.subtotal;
    }

    return {
      valid: true,
      promotionId: promo.id,
      name: promo.name,
      type: promo.type,
      value: Number(promo.value),
      discountAmount,
    };
  }
}
