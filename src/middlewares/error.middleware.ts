import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      return sendError(
        res,
        'DUPLICATE_ENTRY',
        `Data duplikat: data dengan ${target} tersebut sudah ada dalam sistem`,
        409,
        { target: err.meta?.target }
      );
    }

    if (err.code === 'P2025') {
      return sendError(
        res,
        'NOT_FOUND',
        'Data yang diminta tidak ditemukan dalam database',
        404
      );
    }

    if (err.code === 'P2003') {
      return sendError(
        res,
        'FOREIGN_KEY_VIOLATION',
        'Operasi gagal karena data terhubung dengan data lain (foreign key constraint)',
        400
      );
    }
  }

  // Handle custom AppError if thrown
  if (err.statusCode && err.code) {
    return sendError(res, err.code, err.message, err.statusCode, err.details);
  }

  // Generic 500 Internal Server Error
  return sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    'Terjadi kesalahan internal pada server',
    500,
    process.env.NODE_ENV === 'development' ? err.message : undefined
  );
}
