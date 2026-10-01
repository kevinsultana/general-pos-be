import prisma from '../lib/prisma.js';

/**
 * Controller: Mendapatkan semua cabang di tenant aktif
 * GET /api/branches
 */
export const getBranches = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const branches = await prisma.branch.findMany({
      where: { tenantId },
      orderBy: [
        { isMain: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return res.status(200).json({
      success: true,
      data: branches,
    });
  } catch (error) {
    next(error);
  }
};
