import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service.js';
import { sendSuccess } from '../../utils/response.js';

export class AuditController {
  static async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const { entityType, userId, limit } = req.query as {
        entityType?: string;
        userId?: string;
        limit?: string;
      };

      const logs = await AuditService.getLogs(storeId, {
        entityType,
        userId,
        limit: limit ? parseInt(limit, 10) : 50,
      });

      return sendSuccess(res, logs, 'Riwayat audit log berhasil dimuat');
    } catch (err) {
      next(err);
    }
  }
}
