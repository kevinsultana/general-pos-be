import { Request, Response, NextFunction } from 'express';
import { PromotionsService } from './promotions.service.js';
import { sendSuccess } from '../../utils/response.js';

export class PromotionsController {
  static async getPromotions(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const activeOnly = req.query.activeOnly === 'true';
      const promos = await PromotionsService.getPromotions(storeId, activeOnly);
      return sendSuccess(res, promos, 'Daftar promosi berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async getPromotionById(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const promotionId = req.params.id as string;
      const promo = await PromotionsService.getPromotionById(storeId, promotionId);
      return sendSuccess(res, promo, 'Detail promosi berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async createPromotion(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const promo = await PromotionsService.createPromotion(storeId, req.body);
      return sendSuccess(res, promo, 'Promosi berhasil dibuat', 201);
    } catch (err) {
      next(err);
    }
  }

  static async updatePromotion(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const promotionId = req.params.id as string;
      const promo = await PromotionsService.updatePromotion(storeId, promotionId, req.body);
      return sendSuccess(res, promo, 'Promosi berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  static async deletePromotion(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const promotionId = req.params.id as string;
      await PromotionsService.deletePromotion(storeId, promotionId);
      return sendSuccess(res, null, 'Promosi berhasil dihapus');
    } catch (err) {
      next(err);
    }
  }

  static async validatePromoCode(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const result = await PromotionsService.validatePromoCode(storeId, req.body);
      return sendSuccess(res, result, result.valid ? 'Voucher valid' : result.message);
    } catch (err) {
      next(err);
    }
  }
}
