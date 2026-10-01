import rateLimit from 'express-rate-limit';

/**
 * Global DDoS Protection Rate Limiter
 * Membatasi maksimal 100 request per menit per alamat IP untuk seluruh endpoint /api
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 100, // Maksimal 100 request per menit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Terlalu banyak permintaan dari alamat IP Anda, silakan coba lagi dalam beberapa saat.',
  },
});

/**
 * Authentication Rate Limiter (Brute-Force Protection)
 * Membatasi maksimal 10 request per 15 menit per alamat IP untuk route /api/auth/login dan /api/auth/register
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // Maksimal 10 request per 15 menit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Terlalu banyak percobaan autentikasi dari alamat IP Anda. Silakan coba lagi setelah 15 menit.',
  },
});

/**
 * Subscription Transaction Rate Limiter
 * Membatasi maksimal 6 request per 10 menit per alamat IP untuk route /api/subscriptions/create-transaction
 */
export const subscriptionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 menit
  max: 6, // Maksimal 6 request per 10 menit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'SUBSCRIPTION_RATE_LIMIT_EXCEEDED',
    message: 'Terlalu banyak pembuatan transaksi langganan dari alamat IP Anda. Silakan coba lagi setelah 10 menit.',
  },
});

export default {
  apiLimiter,
  authLimiter,
  subscriptionLimiter,
};
