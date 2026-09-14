import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { sendError } from '../utils/response.js';
import { prisma } from '../config/prisma.js';

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Format header autentikasi harus "Bearer <token>"', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    // Verify user is still active in database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { active: true, storeId: true },
    });

    if (!user || !user.active) {
      return sendError(res, 'UNAUTHORIZED', 'Akun pengguna tidak aktif atau tidak ditemukan', 401);
    }

    req.user = payload;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'TOKEN_EXPIRED', 'Sesi login telah kedaluwarsa, silakan refresh token', 401);
    }
    return sendError(res, 'INVALID_TOKEN', 'Token autentikasi tidak valid', 401);
  }
}
