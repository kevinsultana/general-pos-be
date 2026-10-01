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

    // Ambil data user beserta tenant, role, dan branch terkait dari database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        tenant: true,
        role: true,
        userBranches: {
          include: {
            branch: true,
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

    // Tentukan activeBranchId (dari payload token atau fallback ke cabang utama user)
    const mainBranch =
      user.userBranches.find((ub) => ub.branch?.isMain) || user.userBranches[0];
    const activeBranchId = decoded.activeBranchId || mainBranch?.branchId || null;

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
