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

// Trust proxy saat berada di belakang reverse proxy (Nginx, Cloudflare, dll)
// Mencegah error 'X-Forwarded-For' pada express-rate-limit
app.set('trust proxy', 1);

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
      // Izinkan permintaan tanpa origin (seperti mobile app, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Akses diblokir oleh kebijakan keamanan CORS.'));
    },
    credentials: true,
  })
);

// 3. Parser Payload Request
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
