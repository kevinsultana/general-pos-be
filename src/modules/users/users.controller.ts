import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service.js';
import { sendSuccess } from '../../utils/response.js';

export class UsersController {
  static async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const users = await UsersService.getUsers(storeId);
      return sendSuccess(res, users, 'Daftar pengguna berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const userId = req.params.id as string;
      const user = await UsersService.getUserById(storeId, userId);
      return sendSuccess(res, user, 'Detail pengguna berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const currentUserId = req.user!.userId;
      const user = await UsersService.createUser(storeId, req.body, currentUserId);
      return sendSuccess(res, user, 'Pengguna berhasil ditambahkan', 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const currentUserId = req.user!.userId;
      const userId = req.params.id as string;
      const user = await UsersService.updateUser(storeId, userId, req.body, currentUserId);
      return sendSuccess(res, user, 'Pengguna berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }
}
