import { Request, Response, NextFunction } from 'express';
import { RefundsService } from './refunds.service.js';
import { sendSuccess } from '../../utils/response.js';

export class RefundsController {
  static async getRefunds(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const transactionId = req.params.id as string;
      const refunds = await RefundsService.getRefunds(storeId, transactionId);
      return sendSuccess(res, refunds, 'Daftar refund transaksi berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async createRefund(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const currentUserId = req.user!.userId;
      const transactionId = req.params.id as string;
      const refund = await RefundsService.createRefund(storeId, transactionId, req.body, currentUserId);
      return sendSuccess(res, refund, 'Refund transaksi berhasil diproses dan stok dikembalikan', 201);
    } catch (err) {
      next(err);
    }
  }
}
