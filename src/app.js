import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import setupSwagger from './config/swagger.js';
import apiRouter from './routes/index.js';
import notFoundHandler from './middlewares/notFound.middleware.js';
import errorHandler from './middlewares/error.middleware.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI Documentation
setupSwagger(app);

// Mount API Routes
app.use('/api', apiRouter);

// 404 & Centralized Error Handlers
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
