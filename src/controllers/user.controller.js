import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

/**
 * Helper untuk memformat objek user dan menghapus field sensitif (password)
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

/**
 * Controller: Mendapatkan semua user / karyawan di tenant aktif
 * GET /api/users
 */
export const getUsers = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        role: true,
        userBranches: {
          include: {
            branch: true,
          },
        },
      },
      orderBy: [
        { isOwner: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    const safeUsers = users.map((u) => sanitizeUser(u));

    return res.status(200).json({
      success: true,
      data: safeUsers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Menambahkan karyawan baru
 * POST /api/users
 */
export const createUser = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const tenantPlan = req.tenant?.plan || 'FREE';

    const {
      name,
      email,
      password,
      roleId,
      phone,
      pin,
      branchIds = [],
      allBranchesAccess = false,
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap karyawan wajib diisi.',
      });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email karyawan wajib diisi.',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Kata sandi minimal 6 karakter.',
      });
    }

    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: 'Peran (Role) wajib dipilih.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Cek duplikasi email di tenant yang sama
    const existingUser = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: normalizedEmail,
        },
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar sebagai karyawan di toko ini.',
      });
    }

    // 2. Validasi Role
    const role = await prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Peran (Role) tidak ditemukan di toko ini.',
      });
    }

    // 3. Batasan Paket PLUS vs PRO untuk Cabang:
    // Jika paket adalah PLUS (bukan PRO), kunci penugasan user hanya ke Cabang Utama dan allBranchesAccess = false
    const mainBranch = await prisma.branch.findFirst({
      where: { tenantId, isMain: true },
    });

    let assignedBranchIds = [];
    let allowAllBranches = false;

    if (tenantPlan === 'PRO') {
      allowAllBranches = Boolean(allBranchesAccess);
      if (Array.isArray(branchIds) && branchIds.length > 0) {
        // Validasi apakah branchIds milik tenant ini
        const validBranches = await prisma.branch.findMany({
          where: { tenantId, id: { in: branchIds } },
          select: { id: true },
        });
        assignedBranchIds = validBranches.map((b) => b.id);
      } else if (mainBranch) {
        assignedBranchIds = [mainBranch.id];
      }
    } else {
      // Paket PLUS atau FREE
      allowAllBranches = false;
      if (mainBranch) {
        assignedBranchIds = [mainBranch.id];
      }
    }

    // 4. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Simpan User dan Relasi UserBranch secara Atomic
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          roleId,
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          phone: phone?.trim() || null,
          pin: pin?.trim() || null,
          allBranchesAccess: allowAllBranches,
          isOwner: false,
          isActive: true,
        },
      });

      if (assignedBranchIds.length > 0) {
        await tx.userBranch.createMany({
          data: assignedBranchIds.map((branchId, index) => ({
            userId: user.id,
            branchId,
            isDefault: index === 0,
          })),
        });
      }

      return await tx.user.findUnique({
        where: { id: user.id },
        include: {
          role: true,
          userBranches: {
            include: {
              branch: true,
            },
          },
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: 'Karyawan baru berhasil ditambahkan.',
      data: sanitizeUser(newUser),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Memperbarui data karyawan
 * PUT /api/users/:id
 */
export const updateUser = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const tenantPlan = req.tenant?.plan || 'FREE';
    const { id } = req.params;

    const {
      name,
      phone,
      pin,
      password,
      roleId,
      isActive,
      branchIds,
      allBranchesAccess,
    } = req.body;

    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      include: { role: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Karyawan tidak ditemukan.',
      });
    }

    // Cegah penonaktifan diri sendiri jika user adalah Owner
    if (user.isOwner && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Akun Pemilik Toko (Owner) tidak dapat dinonaktifkan.',
      });
    }

    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (pin !== undefined) updateData.pin = pin?.trim() || null;
    if (isActive !== undefined && !user.isOwner) updateData.isActive = Boolean(isActive);

    if (password && password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    // Validasi role jika diubah
    if (roleId && roleId !== user.roleId) {
      const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId },
      });
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Peran baru tidak ditemukan.',
        });
      }
      updateData.roleId = roleId;
    }

    // Update hak akses cabang jika PRO
    if (tenantPlan === 'PRO' && allBranchesAccess !== undefined) {
      updateData.allBranchesAccess = Boolean(allBranchesAccess);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Update user fields
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
      });

      // 2. Jika branchIds diberikan dan paket PRO, sinkronkan cabang
      if (tenantPlan === 'PRO' && Array.isArray(branchIds)) {
        await tx.userBranch.deleteMany({
          where: { userId: id },
        });

        if (branchIds.length > 0) {
          const validBranches = await tx.branch.findMany({
            where: { tenantId, id: { in: branchIds } },
            select: { id: true },
          });

          if (validBranches.length > 0) {
            await tx.userBranch.createMany({
              data: validBranches.map((b, idx) => ({
                userId: id,
                branchId: b.id,
                isDefault: idx === 0,
              })),
            });
          }
        }
      }

      return await tx.user.findUnique({
        where: { id },
        include: {
          role: true,
          userBranches: {
            include: {
              branch: true,
            },
          },
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Data karyawan berhasil diperbarui.',
      data: sanitizeUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Menghapus karyawan
 * DELETE /api/users/:id
 */
export const deleteUser = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Karyawan tidak ditemukan.',
      });
    }

    if (user.isOwner) {
      return res.status(400).json({
        success: false,
        message: 'Akun Pemilik Toko (Owner) tidak dapat dihapus.',
      });
    }

    // Hapus relasi cabang lalu user
    await prisma.$transaction(async (tx) => {
      await tx.userBranch.deleteMany({
        where: { userId: id },
      });
      await tx.user.delete({
        where: { id },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Karyawan berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};
