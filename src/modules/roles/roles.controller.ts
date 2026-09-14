import { Request, Response, NextFunction } from 'express';
import { RolesService } from './roles.service.js';
import { sendSuccess } from '../../utils/response.js';

export class RolesController {
  static async getPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const perms = await RolesService.getPermissions();
      return sendSuccess(res, perms, 'Daftar hak akses sistem berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async getRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const roles = await RolesService.getRoles(storeId);
      return sendSuccess(res, roles, 'Daftar peran berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async getRoleById(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const roleId = req.params.id as string;
      const role = await RolesService.getRoleById(storeId, roleId);
      return sendSuccess(res, role, 'Detail peran berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  static async createRole(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const userId = req.user!.userId;
      const role = await RolesService.createRole(storeId, req.body, userId);
      return sendSuccess(res, role, 'Role berhasil dibuat', 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const userId = req.user!.userId;
      const roleId = req.params.id as string;
      const role = await RolesService.updateRole(storeId, roleId, req.body, userId);
      return sendSuccess(res, role, 'Role berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  static async deleteRole(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      const userId = req.user!.userId;
      const roleId = req.params.id as string;
      await RolesService.deleteRole(storeId, roleId, userId);
      return sendSuccess(res, { deleted: true }, 'Role berhasil dihapus');
    } catch (err) {
      next(err);
    }
  }
}
