import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './config/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`General POS Backend API running on http://0.0.0.0:${env.PORT}`);
  logger.info(`Health check: http://localhost:${env.PORT}/api/v1/health`);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Database disconnected. Server closed.');
    process.exit(0);
  });
});
