import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service.js';
import { sendSuccess } from '../../utils/response.js';

export class InventoryController {
  static async getStockMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const { productId, variantId, limit } = req.query as {
        productId?: string;
        variantId?: string;
        limit?: string;
      };

      const movements = await InventoryService.getStockMovements(storeId, {
        productId,
        variantId,
        limit: limit ? parseInt(limit, 10) : 100,
      });

      return sendSuccess(res, movements, 'Riwayat mutasi stok berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const currentUserId = req.user!.userId;
      const movement = await InventoryService.adjustStock(storeId, req.body, currentUserId);
      return sendSuccess(res, movement, 'Penyesuaian stok berhasil disimpan', 201);
    } catch (err) {
      next(err);
    }
  }
}
