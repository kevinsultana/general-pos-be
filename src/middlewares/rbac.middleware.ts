import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Autentikasi diperlukan', 401);
    }

    // Owner role has full administrative access
    if (req.user.roleName.toLowerCase() === 'owner') {
      return next();
    }

    // Check if user's permissions contain the required permission
    const hasPermission = req.user.permissions.includes(permission);

    if (!hasPermission) {
      return sendError(
        res,
        'FORBIDDEN',
        `Akses ditolak. Anda memerlukan hak akses: "${permission}"`,
        403
      );
    }

    next();
  };
}

export function requireAnyPermission(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Autentikasi diperlukan', 401);
    }

    if (req.user.roleName.toLowerCase() === 'owner') {
      return next();
    }

    const hasAny = permissions.some((p) => req.user!.permissions.includes(p));

    if (!hasAny) {
      return sendError(
        res,
        'FORBIDDEN',
        `Akses ditolak. Anda memerlukan salah satu hak akses: ${permissions.join(', ')}`,
        403
      );
    }

    next();
  };
}
