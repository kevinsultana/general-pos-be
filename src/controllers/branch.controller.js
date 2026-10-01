import prisma from '../lib/prisma.js';
import { generateToken } from '../lib/jwt.js';

/**
 * Controller: Mendapatkan semua cabang di tenant aktif
 * GET /api/branches
 * Protected: authenticate, requirePermission('branches:view')
 */
export const getBranches = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const branches = await prisma.branch.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            userBranches: true,
          },
        },
      },
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

/**
 * Controller: Menambahkan cabang baru
 * POST /api/branches
 * Protected: authenticate, requirePlan('PRO'), requirePermission('branches:manage')
 */
export const createBranch = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { name, address, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama cabang wajib diisi.',
      });
    }

    const newBranch = await prisma.$transaction(async (tx) => {
      // 1. Buat record cabang baru
      const branch = await tx.branch.create({
        data: {
          tenantId,
          name: name.trim(),
          address: address?.trim() || null,
          phone: phone?.trim() || null,
          isMain: false,
          isActive: true,
        },
      });

      // 2. Hubungkan pemilik toko (Owner) ke cabang baru ini secara otomatis
      const owners = await tx.user.findMany({
        where: {
          tenantId,
          isOwner: true,
        },
        select: { id: true },
      });

      if (owners.length > 0) {
        await tx.userBranch.createMany({
          data: owners.map((owner) => ({
            userId: owner.id,
            branchId: branch.id,
            isDefault: false,
          })),
          skipDuplicates: true,
        });
      }

      return branch;
    });

    return res.status(201).json({
      success: true,
      message: 'Cabang baru berhasil ditambahkan.',
      data: newBranch,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Memperbarui data cabang
 * PUT /api/branches/:id
 * Protected: authenticate, requirePermission('branches:manage')
 */
export const updateBranch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { name, address, phone, isActive } = req.body;

    const branch = await prisma.branch.findFirst({
      where: { id, tenantId },
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Cabang tidak ditemukan.',
      });
    }

    // Cabang Utama wajib selalu aktif
    if (branch.isMain && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cabang utama wajib selalu aktif dan tidak dapat dinonaktifkan.',
      });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Nama cabang tidak boleh kosong.',
        });
      }
      updateData.name = name.trim();
    }

    if (address !== undefined) {
      updateData.address = address ? address.trim() : null;
    }

    if (phone !== undefined) {
      updateData.phone = phone ? phone.trim() : null;
    }

    if (isActive !== undefined && !branch.isMain) {
      updateData.isActive = Boolean(isActive);
    }

    const updatedBranch = await prisma.branch.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            userBranches: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Data cabang berhasil diperbarui.',
      data: updatedBranch,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Menghapus cabang
 * DELETE /api/branches/:id
 * Protected: authenticate, requirePlan('PRO'), requirePermission('branches:manage')
 */
export const deleteBranch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const branch = await prisma.branch.findFirst({
      where: { id, tenantId },
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Cabang tidak ditemukan.',
      });
    }

    if (branch.isMain) {
      return res.status(400).json({
        success: false,
        message: 'Cabang utama tidak dapat dihapus.',
      });
    }

    await prisma.branch.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Cabang berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Berpindah cabang aktif (Active Branch Switcher)
 * POST /api/auth/switch-branch atau POST /api/branches/switch-branch
 * Protected: authenticate
 */
export const switchBranch = async (req, res, next) => {
  try {
    const { branchId } = req.body;
    const { user, tenant } = req;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'ID Cabang (branchId) wajib disertakan.',
      });
    }

    // 1. Pastikan cabang ada di toko milik tenant
    const targetBranch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        tenantId: tenant.id,
      },
    });

    if (!targetBranch) {
      return res.status(404).json({
        success: false,
        message: 'Cabang tidak ditemukan atau bukan milik toko Anda.',
      });
    }

    if (!targetBranch.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cabang yang dipilih sedang nonaktif.',
      });
    }

    // 2. Validasi hak akses penugasan cabang
    // Jika owner atau memiliki allBranchesAccess, bebas akses ke cabang manapun
    const isOwner = user.isOwner === true;
    const hasAllAccess = user.allBranchesAccess === true;

    if (!isOwner && !hasAllAccess) {
      const isAssigned = await prisma.userBranch.findFirst({
        where: {
          userId: user.id,
          branchId: targetBranch.id,
        },
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki hak akses penugasan ke cabang ini.',
        });
      }
    }

    // 3. Generate Token JWT baru dengan activeBranchId yang baru
    const token = generateToken({
      userId: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: user.role?.name || 'KASIR',
      activeBranchId: targetBranch.id,
      plan: tenant.plan,
    });

    return res.status(200).json({
      success: true,
      message: `Berhasil beralih ke cabang ${targetBranch.name}.`,
      data: {
        token,
        activeBranch: {
          id: targetBranch.id,
          name: targetBranch.name,
          isMain: targetBranch.isMain,
          address: targetBranch.address,
          phone: targetBranch.phone,
          isActive: targetBranch.isActive,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
