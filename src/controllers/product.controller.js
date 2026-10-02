import prisma from '../lib/prisma.js';

/**
 * GET /api/products
 * Ambil produk milik tenant + cabang aktif.
 * Mendukung: ?page=1&limit=20&search=nama
 */
export const getProducts = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;
    const { page = 1, limit, search } = req.query;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang aktif tidak ditemukan. Silakan pilih cabang terlebih dahulu.',
      });
    }

    const where = { tenantId, branchId };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const hasPagination = limit !== undefined;
    const take = hasPagination ? Math.min(parseInt(limit, 10) || 20, 200) : undefined;
    const skip = hasPagination
      ? (Math.max(parseInt(page, 10) || 1, 1) - 1) * (take || 20)
      : undefined;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          variants: { orderBy: { name: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        ...(take !== undefined ? { take, skip } : {}),
      }),
      prisma.product.count({ where }),
    ]);

    const response = { success: true, data: products };

    if (hasPagination) {
      response.pagination = {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      };
    } else {
      response.total = total;
    }

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products/:id
 * Ambil detail 1 produk (scope by tenant + branch)
 */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;

    const product = await prisma.product.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
      include: { variants: true },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/products
 * Buat produk baru untuk cabang aktif.
 * Logic: jika variants kosong/tidak ada, buat 1 varian default "Regular"
 * dengan costPrice & price dari root payload.
 */
export const createProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;
    const { name, description, costPrice, price, variants } = req.body;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Cabang aktif tidak ditemukan. Silakan pilih cabang terlebih dahulu.',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama produk wajib diisi.' });
    }

    // Tentukan varian yang akan dibuat
    let variantsData;
    const hasVariants = Array.isArray(variants) && variants.length > 0;

    if (hasVariants) {
      for (const v of variants) {
        if (!v.name || !v.name.trim()) {
          return res.status(400).json({
            success: false,
            message: 'Nama varian tidak boleh kosong.',
          });
        }
      }
      variantsData = variants.map((v) => ({
        name: v.name.trim(),
        costPrice: parseFloat(v.costPrice) || 0,
        price: parseFloat(v.price) || 0,
      }));
    } else {
      variantsData = [
        {
          name: 'Regular',
          costPrice: parseFloat(costPrice) || 0,
          price: parseFloat(price) || 0,
        },
      ];
    }

    const product = await prisma.product.create({
      data: {
        tenantId,
        branchId,
        name: name.trim(),
        description: description?.trim() || null,
        variants: { create: variantsData },
      },
      include: { variants: true },
    });

    return res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/products/:id
 * Update produk (nama & deskripsi) — scope by tenant + branch
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;
    const { name, description, isActive } = req.body;

    const existing = await prisma.product.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: 'Nama produk tidak boleh kosong.' });
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { variants: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Produk berhasil diperbarui.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/products/:id
 * Hapus produk (cascade ke varian) — scope by tenant + branch
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;

    const existing = await prisma.product.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    await prisma.product.delete({ where: { id } });

    return res.status(200).json({ success: true, message: 'Produk berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/products/:id/variants/:variantId
 * Update harga varian spesifik — scope by tenant + branch
 */
export const updateVariant = async (req, res, next) => {
  try {
    const { id, variantId } = req.params;
    const tenantId = req.tenantId;
    const branchId = req.activeBranchId;
    const { name, costPrice, price } = req.body;

    const product = await prisma.product.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId: id },
    });
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Varian tidak ditemukan.' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (costPrice !== undefined) updateData.costPrice = parseFloat(costPrice) || 0;
    if (price !== undefined) updateData.price = parseFloat(price) || 0;

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Varian berhasil diperbarui.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
