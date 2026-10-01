import prisma from '../lib/prisma.js';

/**
 * Controller: Mendapatkan semua kategori produk milik tenant aktif
 * GET /api/categories
 * Protected: authenticate, requirePermission('inventory:view')
 */
export const getCategories = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const categories = await prisma.category.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Membuat kategori baru
 * POST /api/categories
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const createCategory = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { name, color } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama kategori wajib diisi.',
      });
    }

    const category = await prisma.category.create({
      data: {
        tenantId,
        name: name.trim(),
        color: color ? color.trim() : '#f59e0b',
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Kategori berhasil ditambahkan.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Memperbarui data kategori
 * PUT /api/categories/:id
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const updateCategory = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, color } = req.body;

    const existingCategory = await prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan atau bukan milik toko Anda.',
      });
    }

    const updateData = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Nama kategori tidak boleh kosong.',
        });
      }
      updateData.name = name.trim();
    }
    if (color !== undefined) {
      updateData.color = color ? color.trim() : null;
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Kategori berhasil diperbarui.',
      data: updatedCategory,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Menghapus kategori
 * DELETE /api/categories/:id
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const deleteCategory = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const existingCategory = await prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan atau bukan milik toko Anda.',
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Kategori berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
