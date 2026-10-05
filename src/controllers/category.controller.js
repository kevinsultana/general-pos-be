import prisma from '../lib/prisma.js';

/**
 * GET /api/categories
 * Semua kategori produk milik tenant, terurut sortOrder lalu nama.
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/categories
 */
export const createCategory = async (req, res, next) => {
  try {
    const { name, sortOrder } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi.' });
    }
    const category = await prisma.productCategory.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        sortOrder: parseInt(sortOrder) || 0,
      },
    });
    return res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Nama kategori sudah digunakan.' });
    }
    next(err);
  }
};

/**
 * PUT /api/categories/:id
 */
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, sortOrder, isActive } = req.body;

    const existing = await prisma.productCategory.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
    }

    const data = {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ success: false, message: 'Nama kategori tidak boleh kosong.' });
      data.name = name.trim();
    }
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder) || 0;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.productCategory.update({ where: { id }, data });
    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Nama kategori sudah digunakan.' });
    }
    next(err);
  }
};

/**
 * DELETE /api/categories/:id
 * Produk yang terhubung akan di-set categoryId = null (SetNull).
 */
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.productCategory.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
    }
    await prisma.productCategory.delete({ where: { id } });
    return res.json({ success: true, message: 'Kategori berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
};
