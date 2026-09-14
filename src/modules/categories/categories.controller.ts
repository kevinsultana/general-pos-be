import { Request, Response, NextFunction } from 'express';
import { CategoriesService } from './categories.service.js';
import { sendSuccess } from '../../utils/response.js';

export class CategoriesController {
  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const categories = await CategoriesService.getCategories(storeId);
      return sendSuccess(res, categories, 'Daftar kategori berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const categoryId = req.params.id as string;
      const category = await CategoriesService.getCategoryById(storeId, categoryId);
      return sendSuccess(res, category, 'Detail kategori berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const created = await CategoriesService.createCategory(storeId, req.body);
      return sendSuccess(res, created, 'Kategori berhasil dibuat', 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const categoryId = req.params.id as string;
      const updated = await CategoriesService.updateCategory(storeId, categoryId, req.body);
      return sendSuccess(res, updated, 'Kategori berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const categoryId = req.params.id as string;
      await CategoriesService.deleteCategory(storeId, categoryId);
      return sendSuccess(res, { deleted: true }, 'Kategori berhasil dihapus');
    } catch (err) {
      next(err);
    }
  }
}
