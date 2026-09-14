import { Request, Response, NextFunction } from 'express';
import { CustomersService } from './customers.service.js';
import { sendSuccess } from '../../utils/response.js';

export class CustomersController {
  static async getCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const search = req.query.search as string | undefined;
      const customers = await CustomersService.getCustomers(storeId, search);
      return sendSuccess(res, customers, 'Daftar pelanggan berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerById(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const customerId = req.params.id as string;
      const customer = await CustomersService.getCustomerById(storeId, customerId);
      return sendSuccess(res, customer, 'Detail pelanggan berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async createCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const customer = await CustomersService.createCustomer(storeId, req.body);
      return sendSuccess(res, customer, 'Pelanggan berhasil ditambahkan', 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const customerId = req.params.id as string;
      const customer = await CustomersService.updateCustomer(storeId, customerId, req.body);
      return sendSuccess(res, customer, 'Pelanggan berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  static async deleteCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const customerId = req.params.id as string;
      await CustomersService.deleteCustomer(storeId, customerId);
      return sendSuccess(res, { deleted: true }, 'Pelanggan berhasil dihapus');
    } catch (err) {
      next(err);
    }
  }
}
