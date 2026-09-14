import { Request, Response, NextFunction } from 'express';
import { PrintersService } from './printers.service.js';
import { sendSuccess } from '../../utils/response.js';

export class PrintersController {
  static async getPrinters(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const role = req.query.role as string | undefined;
      const printers = await PrintersService.getPrinters(storeId, role);
      return sendSuccess(res, printers, 'Daftar printer berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async getPrinterById(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const printerId = req.params.id as string;
      const printer = await PrintersService.getPrinterById(storeId, printerId);
      return sendSuccess(res, printer, 'Detail printer berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async createPrinter(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const printer = await PrintersService.createPrinter(storeId, req.body);
      return sendSuccess(res, printer, 'Printer berhasil ditambahkan', 201);
    } catch (err) {
      next(err);
    }
  }

  static async updatePrinter(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const printerId = req.params.id as string;
      const printer = await PrintersService.updatePrinter(storeId, printerId, req.body);
      return sendSuccess(res, printer, 'Printer berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  static async deletePrinter(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const printerId = req.params.id as string;
      await PrintersService.deletePrinter(storeId, printerId);
      return sendSuccess(res, { deleted: true }, 'Printer berhasil dihapus');
    } catch (err) {
      next(err);
    }
  }
}
