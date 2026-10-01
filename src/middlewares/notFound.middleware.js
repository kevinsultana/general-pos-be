/**
 * 404 Not Found Middleware
 * Menangani rute yang tidak cocok dengan route handler manapun.
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export default notFoundHandler;
