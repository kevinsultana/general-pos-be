/**
 * Global Centralized Error Handler Middleware
 * Menangani error di seluruh middleware/controller secara terpusat dan konsisten.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isDevelopment = process.env.NODE_ENV !== 'production';

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

  // 3. Penanganan error umum / internal server error (500)
  return res.status(statusCode).json({
    success: false,
    code: err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'),
    message: err.message || 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack }),
  });
};

export default errorHandler;
