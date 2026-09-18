import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body);
      return sendSuccess(res, result, 'Login berhasil');
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.refreshToken(refreshToken);
      return sendSuccess(res, result, 'Token berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const profile = await AuthService.getMe(userId);
      return sendSuccess(res, profile, 'Data pengguna berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await AuthService.logout(req.user!.userId, req.user!.storeId);
      return sendSuccess(res, { loggedOut: true }, 'Logout berhasil');
    } catch (err) {
      next(err);
    }
  }

  static async registerStore(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.registerStore(req.body);
      return sendSuccess(res, result, 'Pendaftaran toko berhasil', 201);
    } catch (err) {
      next(err);
    }
  }
}
