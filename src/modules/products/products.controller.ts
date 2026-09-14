import { Request, Response, NextFunction } from 'express';
import { ProductsService } from './products.service.js';
import { sendSuccess } from '../../utils/response.js';

export class ProductsController {
  static async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const { categoryId, search, activeOnly, lowStockOnly } = req.query as {
        categoryId?: string;
        search?: string;
        activeOnly?: string;
        lowStockOnly?: string;
      };

      const products = await ProductsService.getProducts(storeId, {
        categoryId,
        search,
        activeOnly: activeOnly === 'true',
        lowStockOnly: lowStockOnly === 'true',
      });

      return sendSuccess(res, products, 'Daftar produk berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const productId = req.params.id as string;
      const product = await ProductsService.getProductById(storeId, productId);
      return sendSuccess(res, product, 'Detail produk berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const userId = req.user!.userId;
      const product = await ProductsService.createProduct(storeId, req.body, userId);
      return sendSuccess(res, product, 'Produk berhasil dibuat', 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const userId = req.user!.userId;
      const productId = req.params.id as string;
      const product = await ProductsService.updateProduct(storeId, productId, req.body, userId);
      return sendSuccess(res, product, 'Produk berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const userId = req.user!.userId;
      const productId = req.params.id as string;
      const result = await ProductsService.deleteProduct(storeId, productId, userId);
      return sendSuccess(
        res,
        result,
        result.deactivated
          ? 'Produk memiliki riwayat transaksi dan telah dinonaktifkan secara aman'
          : 'Produk berhasil dihapus'
      );
    } catch (err) {
      next(err);
    }
  }
}
