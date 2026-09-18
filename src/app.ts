import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { sendSuccess, sendError } from './utils/response.js';

// Route Imports
import authRoutes from './modules/auth/auth.routes.js';
import storeRoutes from './modules/store/store.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import rolesRoutes from './modules/roles/roles.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import transactionsRoutes from './modules/transactions/transactions.routes.js';
import refundsRoutes from './modules/refunds/refunds.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import promotionsRoutes from './modules/promotions/promotions.routes.js';
import printersRoutes from './modules/printers/printers.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import syncRoutes from './modules/sync/sync.routes.js';
import subscriptionRoutes from './modules/subscription/subscription.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';

export function createApp(): Express {
  const app = express();

  // Global Security & Parsers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'cdn.jsdelivr.net', 'validator.swagger.io'],
        upgradeInsecureRequests: null, // Jangan paksa upgrade ke https saat diakses lewat HTTP biasa / Tailscale IP
      },
    },
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors());
  app.use(express.json());

  // ──── Swagger API Documentation ────
  // Akses di browser: http://localhost:PORT/api-docs atau via IP Tailscale
  app.use(
    '/api-docs',
    (_req: Request, res: Response, next: NextFunction) => {
      res.removeHeader('Content-Security-Policy');
      res.removeHeader('Cross-Origin-Opener-Policy');
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'General POS API Docs',
      customCss: `.swagger-ui .topbar { background-color: #1e1e2e; }
        .swagger-ui .topbar-wrapper .link span { display: none; }
        .swagger-ui .info h1 { color: #cba6f7; }`,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
      },
    })
  );
  // Raw JSON spec endpoint
  app.get('/api-docs.json', (_req: Request, res: Response) => res.json(swaggerSpec));

  // Health Check Endpoints
  const healthHandler = (_req: Request, res: Response) => {
    return sendSuccess(res, {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'general-pos-backend',
    }, 'Backend API is running smoothly');
  };
  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // Mount API Modules
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/store', storeRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/roles', rolesRoutes);
  app.use('/api/v1/categories', categoriesRoutes);
  app.use('/api/v1/products', productsRoutes);
  app.use('/api/v1/customers', customersRoutes);
  app.use('/api/v1', inventoryRoutes); // /api/v1/stock-movements
  app.use('/api/v1/transactions', transactionsRoutes);
  app.use('/api/v1/transactions', refundsRoutes); // /api/v1/transactions/:id/refunds
  app.use('/api/v1/payment-methods', paymentsRoutes);
  app.use('/api/v1/promotions', promotionsRoutes);
  app.use('/api/v1/printers', printersRoutes);
  app.use('/api/v1/audit-logs', auditRoutes);
  app.use('/api/v1/sync', syncRoutes);
  app.use('/api/v1/subscription', subscriptionRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);

  // 404 Route Not Found
  app.use((req: Request, res: Response) => {
    return sendError(res, 'ROUTE_NOT_FOUND', `Rute ${req.method} ${req.path} tidak ditemukan`, 404);
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
