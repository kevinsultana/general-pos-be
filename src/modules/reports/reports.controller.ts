import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service.js';
import { sendSuccess } from '../../utils/response.js';

export class ReportsController {
  static async getSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const { startDate, endDate } = req.query;

      const report = await ReportsService.getSalesReport(storeId, {
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });

      return sendSuccess(res, report, 'Laporan penjualan berhasil dimuat');
    } catch (err) {
      next(err);
    }
  }

  static async getProductReport(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const { startDate, endDate, limit } = req.query;

      const report = await ReportsService.getProductPerformanceReport(storeId, {
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return sendSuccess(res, report, 'Laporan performa produk berhasil dimuat');
    } catch (err) {
      next(err);
    }
  }

  static async getInventoryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const report = await ReportsService.getInventoryReport(storeId);

      return sendSuccess(res, report, 'Laporan inventori berhasil dimuat');
    } catch (err) {
      next(err);
    }
  }
}
