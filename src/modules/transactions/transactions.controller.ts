import { Request, Response, NextFunction } from 'express';
import { TransactionsService } from './transactions.service.js';
import { sendSuccess } from '../../utils/response.js';

export class TransactionsController {
  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const { status, startDate, endDate, limit, offset } = req.query as {
        status?: string;
        startDate?: string;
        endDate?: string;
        limit?: string;
        offset?: string;
      };

      const result = await TransactionsService.getTransactions(storeId, {
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      return sendSuccess(res, result.transactions, 'Daftar transaksi berhasil diambil', 200, {
        total: result.total,
        limit: result.limit,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTransactionById(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const transactionId = req.params.id as string;
      const transaction = await TransactionsService.getTransactionById(storeId, transactionId);
      return sendSuccess(res, transaction, 'Detail transaksi berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async completeTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const currentUserId = req.user!.userId;
      const transaction = await TransactionsService.completeTransaction(storeId, req.body, currentUserId);
      const isExisting = (transaction as any).isExisting;
      return sendSuccess(
        res,
        transaction,
        isExisting ? 'Transaksi sudah pernah diproses' : 'Transaksi berhasil diselesaikan',
        isExisting ? 200 : 201
      );
    } catch (err) {
      next(err);
    }
  }

  static async cancelTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const currentUserId = req.user!.userId;
      const transactionId = req.params.id as string;
      const cancelled = await TransactionsService.cancelTransaction(storeId, transactionId, req.body, currentUserId);
      return sendSuccess(res, cancelled, 'Transaksi berhasil dibatalkan dan stok dikembalikan');
    } catch (err) {
      next(err);
    }
  }
}
