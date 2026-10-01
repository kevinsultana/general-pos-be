/**
 * Global Centralized Error Handler Middleware
 * Menangani error di seluruh middleware/controller secara terpusat, aman, dan konsisten.
 * Mencegah kebocoran stack trace dan detail internal sensitif ke pengguna.
 *
 * [M-3] Tambahan: Handle Prisma error codes (P2002, P2025) secara eksplisit.
 */
export const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log error di internal server console untuk keperluan debugging developer/sysadmin
  console.error('[Internal Error Handler]', {
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    code: err.code,
    stack: isDevelopment ? err.stack : undefined,
  });

  // [M-3] Prisma Known Error — P2002: Unique constraint violation (Duplicate Entry)
  if (err.code === 'P2002') {
    const fields = err.meta?.target || [];
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_ENTRY',
      message: `Data sudah ada: ${fields.join(', ')} harus unik.`,
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  // [M-3] Prisma Known Error — P2025: Record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: err.meta?.cause || 'Data yang diminta tidak ditemukan.',
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  // [M-3] Prisma Known Error — P2003: Foreign key constraint failed
  if (err.code === 'P2003') {
    return res.status(400).json({
      success: false,
      code: 'FOREIGN_KEY_CONSTRAINT',
      message: 'Operasi gagal: data terkait tidak ditemukan atau masih digunakan.',
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  const statusCode = err.statusCode || err.status || 500;

  // 1. Penanganan khusus jika error bertipe 403 Forbidden (RBAC / Plan Restricted / Permission Denied)
  if (statusCode === 403) {
    return res.status(403).json({
      success: false,
      code: err.code || 'FORBIDDEN',
      message:
        err.message ||
        'Akses ditolak: Anda tidak memiliki izin untuk melakukan tindakan ini.',
      ...(err.minPlan && { minPlan: err.minPlan }),
      ...(err.requiredPermission && {
        requiredPermission: err.requiredPermission,
      }),
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  // 2. Penanganan khusus jika error bertipe 401 Unauthorized
  if (statusCode === 401) {
    return res.status(401).json({
      success: false,
      code: err.code || 'UNAUTHORIZED',
      message: err.message || 'Otentikasi diperlukan.',
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  // 3. Penanganan error 400 Bad Request
  if (statusCode === 400) {
    return res.status(400).json({
      success: false,
      code: err.code || 'BAD_REQUEST',
      message: err.message || 'Permintaan tidak valid.',
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  // 4. Penanganan error umum / internal server error (500)
  // Jangan membocorkan error internal database / prisma / stack trace ke client
  const safeMessage = isDevelopment
    ? err.message || 'Internal Server Error'
    : 'Terjadi kesalahan pada sistem server. Silakan hubungi dukungan teknis.';

  return res.status(statusCode).json({
    success: false,
    code: err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'),
    message: safeMessage,
    ...(isDevelopment && { stack: err.stack }),
  });
};

export default errorHandler;
