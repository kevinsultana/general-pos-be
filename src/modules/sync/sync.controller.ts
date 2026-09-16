import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response.js';
import { SyncService } from './sync.service.js';
import { PushRequestSchema } from './sync.schemas.js';

export class SyncController {
  static async push(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const currentUserId = req.user!.userId;

      // Validate request body
      const parseResult = PushRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return sendError(res, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Body tidak valid', 400);
      }

      const { events } = parseResult.data;
      const deviceId = req.headers['x-device-id'] as string || events[0]?.deviceId || 'unknown';

      const result = await SyncService.push(storeId, currentUserId, deviceId, events);

      return sendSuccess(
        res,
        result,
        `Sync push selesai: ${result.synced} berhasil, ${result.failed} gagal, ${result.skipped} dilewati`
      );
    } catch (err) {
      next(err);
    }
  }

  static async pull(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const cursor = (req.query.cursor as string) || '0';
      const deviceId = (req.query.deviceId as string) || (req.headers['x-device-id'] as string) || 'unknown';
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const result = await SyncService.pull(storeId, deviceId, cursor, limit);

      return sendSuccess(res, result, `Sync pull berhasil: ${result.events.length} events`);
    } catch (err) {
      next(err);
    }
  }

  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const status = await SyncService.getSyncStatus(storeId);
      return sendSuccess(res, status, 'Status sinkronisasi berhasil diambil');
    } catch (err) {
      next(err);
    }
  }
}
