import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import setupSwagger from './config/swagger.js';
import apiRouter from './routes/index.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import notFoundHandler from './middlewares/notFound.middleware.js';
import errorHandler from './middlewares/error.middleware.js';

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Menjaga kompatibilitas Swagger UI inline assets
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. Konfigurasi CORS Ketat
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan permintaan tanpa origin (mobile app, server-to-server, Postman)
      // [M-5] Di production, log request tanpa origin untuk audit
      if (!origin) {
        if (process.env.NODE_ENV === 'production') {
          console.warn('[CORS] Request tanpa Origin header diterima:', {
            timestamp: new Date().toISOString(),
            path: 'N/A (log dari CORS handler)',
          });
        }
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Akses diblokir oleh kebijakan keamanan CORS.'));
    },
    credentials: true,
  })
);

// 3. Parser Payload Request — [H-2] Batasi ukuran body maksimal 1MB untuk mencegah payload flooding
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Swagger UI Documentation
setupSwagger(app);

// 5. Mount API Routes dengan Proteksi DDoS Global Rate Limiter
app.use('/api', apiLimiter, apiRouter);

// 6. 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Bootstrap Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Server] Server berjalan di http://localhost:${PORT}`);
    console.log(`[Swagger] Dokumentasi API tersedia di http://localhost:${PORT}/api-docs`);
  });
}

export default app;
