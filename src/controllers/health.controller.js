import prisma from '../lib/prisma.js';

/**
 * Controller untuk pengecekan kesehatan server dan koneksi database
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getHealth = async (req, res, next) => {
  let databaseStatus = 'disconnected';

  try {
    // Query ringan SELECT 1 untuk memastikan konektivitas database PostgreSQL aktif
    await prisma.$queryRaw`SELECT 1`;
    databaseStatus = 'connected';
  } catch (error) {
    databaseStatus = 'disconnected';
  }

  const healthData = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      status: databaseStatus,
    },
  };

  return res.status(200).json(healthData);
};

export default {
  getHealth,
};
