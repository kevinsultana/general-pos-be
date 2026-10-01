import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Singleton Instance
 * Digunakan secara terpusat untuk menghindari inisialisasi berulang (connection pool leak)
 * terutama saat hot-reloading di environment development.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
