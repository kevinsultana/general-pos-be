import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service.js';
import { sendSuccess } from '../../utils/response.js';

export class PaymentsController {
  static async getPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const enabledOnly = req.query.enabledOnly === 'true';
      const methods = await PaymentsService.getPaymentMethods(storeId, enabledOnly);
      return sendSuccess(res, methods, 'Metode pembayaran berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async createPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const method = await PaymentsService.createPaymentMethod(storeId, req.body);
      return sendSuccess(res, method, 'Metode pembayaran berhasil ditambahkan', 201);
    } catch (err) {
      next(err);
    }
  }

  static async updatePaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const methodId = req.params.id as string;
      const method = await PaymentsService.updatePaymentMethod(storeId, methodId, req.body);
      return sendSuccess(res, method, 'Metode pembayaran berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }
}
