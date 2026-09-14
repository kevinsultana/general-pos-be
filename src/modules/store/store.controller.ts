import { Request, Response, NextFunction } from 'express';
import { StoreService } from './store.service.js';
import { sendSuccess } from '../../utils/response.js';

export class StoreController {
  static async getStore(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const store = await StoreService.getStore(storeId);
      return sendSuccess(res, store, 'Data toko berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async updateStore(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const userId = req.user!.userId;
      const updated = await StoreService.updateStore(storeId, req.body, userId);
      return sendSuccess(res, updated, 'Pengaturan toko berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }
}
