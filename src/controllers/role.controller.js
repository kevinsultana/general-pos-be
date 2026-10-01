import prisma from '../lib/prisma.js';

/**
 * Controller: Mendapatkan semua roles di tenant aktif
 * GET /api/roles
 */
export const getRoles = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const roles = await prisma.role.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: [
        { isSystem: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Membuat role baru untuk tenant
 * POST /api/roles
 */
export const createRole = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { name, description, permissions } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama peran wajib diisi.',
      });
    }

    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Minimal satu hak akses (permission) harus dipilih.',
      });
    }

    const normalizedName = name.trim().toUpperCase();

    // Periksa duplikasi nama role di tenant yang sama
    const existingRole = await prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: normalizedName,
        },
      },
    });

    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: `Peran dengan nama "${normalizedName}" sudah ada di toko ini.`,
      });
    }

    const newRole = await prisma.role.create({
      data: {
        tenantId,
        name: normalizedName,
        description: description?.trim() || null,
        isSystem: false,
        permissions,
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Peran kustom berhasil dibuat.',
      data: newRole,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Memperbarui role yang ada
 * PUT /api/roles/:id
 */
export const updateRole = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await prisma.role.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Peran tidak ditemukan.',
      });
    }

    const updateData = {};

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Daftar hak akses (permissions) tidak boleh kosong.',
        });
      }
      updateData.permissions = permissions;
    }

    // Cegah pengubahan nama jika peran adalah bawaan sistem (isSystem === true)
    if (name !== undefined) {
      const normalizedName = name.trim().toUpperCase();
      if (role.isSystem && normalizedName !== role.name) {
        return res.status(400).json({
          success: false,
          message: 'Nama peran bawaan sistem tidak boleh diubah.',
        });
      }

      if (!role.isSystem && normalizedName !== role.name) {
        // Cek duplikasi jika nama berubah
        const existing = await prisma.role.findUnique({
          where: {
            tenantId_name: {
              tenantId,
              name: normalizedName,
            },
          },
        });

        if (existing && existing.id !== id) {
          return res.status(409).json({
            success: false,
            message: `Peran dengan nama "${normalizedName}" sudah ada.`,
          });
        }
        updateData.name = normalizedName;
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Peran berhasil diperbarui.',
      data: updatedRole,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Menghapus role
 * DELETE /api/roles/:id
 */
export const deleteRole = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const role = await prisma.role.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        users: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Peran tidak ditemukan.',
      });
    }

    if (role.isSystem) {
      return res.status(400).json({
        success: false,
        message: 'Peran bawaan sistem tidak dapat dihapus.',
      });
    }

    if (role.users && role.users.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menghapus peran ini karena masih digunakan oleh ${role.users.length} karyawan aktif.`,
      });
    }

    await prisma.role.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Peran berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};
