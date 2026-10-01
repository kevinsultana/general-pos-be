import { verifyToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';

/**
 * Middleware untuk memverifikasi JWT Bearer Token
 * Menyematkan req.user, req.tenantId, dan req.activeBranchId ke request
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token otentikasi tidak ditemukan atau format tidak valid (gunakan Bearer <token>)',
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = verifyToken(token);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Sesi login telah kedaluwarsa. Silakan masuk kembali.',
        });
      }
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Token otentikasi tidak valid.',
      });
    }

    // Optimasi Query Database: Gunakan select spesifik untuk mengurangi beban PostgreSQL
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        isOwner: true,
        isActive: true,
        allBranchesAccess: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            planStatus: true,
            billingCycle: true,
            subscriptionExpiresAt: true,
            proJoinedAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak ditemukan dalam sistem.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'USER_INACTIVE',
        message: 'Akun pengguna telah dinonaktifkan oleh administrator.',
      });
    }

    if (!user.tenant) {
      return res.status(401).json({
        success: false,
        message: 'Tenant toko tidak ditemukan atau telah dihapus.',
      });
    }

    // [H-1 / L-3] Validasi activeBranchId terhadap database:
    // Pastikan branch ada, aktif, dan benar-benar milik tenant yang sama
    let activeBranchId = decoded.activeBranchId || null;

    if (activeBranchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: activeBranchId },
        select: { id: true, tenantId: true, isActive: true },
      });

      if (!branch || branch.tenantId !== user.tenantId || !branch.isActive) {
        // Branch tidak valid: reset ke null — controller yang butuh branchId akan handle sendiri
        activeBranchId = null;
      }
    }

    // Sematkan informasi penting ke objek request
    req.user = user;
    req.tenantId = user.tenantId;
    req.tenant = user.tenant;
    req.activeBranchId = activeBranchId;

    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
