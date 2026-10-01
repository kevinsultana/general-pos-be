import prisma from '../lib/prisma.js';

/**
 * Controller: Mendapatkan daftar produk dengan filter, pencarian, dan paginasi
 * GET /api/products
 * Protected: authenticate, requirePermission('inventory:view')
 */
export const getProducts = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const {
      page = 1,
      limit = 20,
      search = '',
      categoryId = '',
      branchId = '',
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    // Filter Where
    const where = {
      tenantId,
    };

    if (categoryId && categoryId.trim()) {
      where.categoryId = categoryId.trim();
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Branch ID untuk stok (prioritaskan query param, lalu activeBranchId)
    const targetBranchId = branchId || req.activeBranchId || null;

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          variants: {
            orderBy: { name: 'asc' },
          },
          unitPrices: {
            orderBy: { conversionRate: 'asc' },
          },
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  options: true,
                },
              },
            },
          },
          stocks: targetBranchId
            ? {
                where: { branchId: targetBranchId },
                include: {
                  branch: {
                    select: { id: true, name: true, isMain: true },
                  },
                },
              }
            : {
                include: {
                  branch: {
                    select: { id: true, name: true, isMain: true },
                  },
                },
              },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parsedLimit,
      }),
      prisma.product.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Mendapatkan detail produk tunggal berdasarkan ID
 * GET /api/products/:id
 * Protected: authenticate, requirePermission('inventory:view')
 */
export const getProductById = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        variants: true,
        unitPrices: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                options: true,
              },
            },
          },
        },
        stocks: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan atau bukan milik toko Anda.',
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Membuat produk baru dalam 1 transaksi atomic
 * POST /api/products
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const createProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const {
      name,
      categoryId = null,
      basePrice = 0,
      cogs = 0,
      sku = null,
      barcode = null,
      description = null,
      image = null,
      isService = false,
      trackStock = true,
      initialStock = 0,
      minStock = 5,
      branchId = null,
      variants = [],
      unitPrices = [],
      modifierGroupIds = [],
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama produk wajib diisi.',
      });
    }

    // Ambil daftar seluruh cabang milik tenant untuk inisialisasi stok
    const tenantBranches = await prisma.branch.findMany({
      where: { tenantId },
      select: { id: true, isMain: true },
    });

    const activeBranchTarget = branchId || req.activeBranchId || tenantBranches.find((b) => b.isMain)?.id;

    const newProduct = await prisma.$transaction(async (tx) => {
      // 1. Buat Record Produk Utama
      const product = await tx.product.create({
        data: {
          tenantId,
          categoryId: categoryId || null,
          name: name.trim(),
          basePrice: Math.max(0, parseInt(basePrice, 10) || 0),
          cogs: Math.max(0, parseInt(cogs, 10) || 0),
          sku: sku ? sku.trim() : null,
          barcode: barcode ? barcode.trim() : null,
          description: description ? description.trim() : null,
          image: image || null,
          isService: Boolean(isService),
          trackStock: isService ? false : Boolean(trackStock),
        },
      });

      // 2. Inisialisasi Stok per Cabang
      if (tenantBranches.length > 0 && !isService && trackStock) {
        const stockEntries = tenantBranches.map((branch) => {
          const isTargetBranch = branch.id === activeBranchTarget;
          return {
            productId: product.id,
            branchId: branch.id,
            quantity: isTargetBranch ? Math.max(0, parseFloat(initialStock) || 0) : 0,
            minStock: Math.max(0, parseInt(minStock, 10) || 5),
          };
        });

        await tx.productStock.createMany({
          data: stockEntries,
        });
      }

      // 3. Tambahkan Varian jika ada
      if (Array.isArray(variants) && variants.length > 0) {
        const validVariants = variants
          .filter((v) => v.name && v.name.trim())
          .map((v) => ({
            productId: product.id,
            name: v.name.trim(),
            priceAdj: parseInt(v.priceAdj, 10) || 0,
            sku: v.sku ? v.sku.trim() : null,
            barcode: v.barcode ? v.barcode.trim() : null,
          }));

        if (validVariants.length > 0) {
          await tx.productVariant.createMany({
            data: validVariants,
          });
        }
      }

      // 4. Tambahkan Satuan Bertingkat (UOM) jika ada
      if (Array.isArray(unitPrices) && unitPrices.length > 0) {
        const validUnits = unitPrices
          .filter((u) => u.name && u.name.trim())
          .map((u) => ({
            productId: product.id,
            name: u.name.trim(),
            conversionRate: Math.max(1, parseInt(u.conversionRate, 10) || 1),
            price: Math.max(0, parseInt(u.price, 10) || 0),
          }));

        if (validUnits.length > 0) {
          await tx.productUnit.createMany({
            data: validUnits,
          });
        }
      }

      // 5. Hubungkan Modifier Groups jika ada
      if (Array.isArray(modifierGroupIds) && modifierGroupIds.length > 0) {
        const relations = modifierGroupIds.map((groupId) => ({
          productId: product.id,
          modifierGroupId: groupId,
        }));

        await tx.productModifierGroup.createMany({
          data: relations,
          skipDuplicates: true,
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          category: true,
          variants: true,
          unitPrices: true,
          stocks: true,
          modifierGroups: {
            include: {
              modifierGroup: true,
            },
          },
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan.',
      data: newProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Memperbarui data produk dan relasinya
 * PUT /api/products/:id
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const updateProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const {
      name,
      categoryId,
      basePrice,
      cogs,
      sku,
      barcode,
      description,
      image,
      isService,
      trackStock,
      variants,
      unitPrices,
      modifierGroupIds,
    } = req.body;

    const existingProduct = await prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan atau bukan milik toko Anda.',
      });
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      // 1. Update data pokok
      const updateData = {};
      if (name !== undefined) {
        if (!name.trim()) throw new Error('Nama produk tidak boleh kosong.');
        updateData.name = name.trim();
      }
      if (categoryId !== undefined) updateData.categoryId = categoryId || null;
      if (basePrice !== undefined) updateData.basePrice = Math.max(0, parseInt(basePrice, 10) || 0);
      if (cogs !== undefined) updateData.cogs = Math.max(0, parseInt(cogs, 10) || 0);
      if (sku !== undefined) updateData.sku = sku ? sku.trim() : null;
      if (barcode !== undefined) updateData.barcode = barcode ? barcode.trim() : null;
      if (description !== undefined) updateData.description = description ? description.trim() : null;
      if (image !== undefined) updateData.image = image || null;
      if (isService !== undefined) updateData.isService = Boolean(isService);
      if (trackStock !== undefined) updateData.trackStock = Boolean(trackStock);

      await tx.product.update({
        where: { id },
        data: updateData,
      });

      // 2. Sinkronisasi Varian jika disertakan
      if (Array.isArray(variants)) {
        await tx.productVariant.deleteMany({ where: { productId: id } });
        if (variants.length > 0) {
          await tx.productVariant.createMany({
            data: variants
              .filter((v) => v.name && v.name.trim())
              .map((v) => ({
                productId: id,
                name: v.name.trim(),
                priceAdj: parseInt(v.priceAdj, 10) || 0,
                sku: v.sku ? v.sku.trim() : null,
                barcode: v.barcode ? v.barcode.trim() : null,
              })),
          });
        }
      }

      // 3. Sinkronisasi Satuan Bertingkat jika disertakan
      if (Array.isArray(unitPrices)) {
        await tx.productUnit.deleteMany({ where: { productId: id } });
        if (unitPrices.length > 0) {
          await tx.productUnit.createMany({
            data: unitPrices
              .filter((u) => u.name && u.name.trim())
              .map((u) => ({
                productId: id,
                name: u.name.trim(),
                conversionRate: Math.max(1, parseInt(u.conversionRate, 10) || 1),
                price: Math.max(0, parseInt(u.price, 10) || 0),
              })),
          });
        }
      }

      // 4. Sinkronisasi Modifier Groups jika disertakan
      if (Array.isArray(modifierGroupIds)) {
        await tx.productModifierGroup.deleteMany({ where: { productId: id } });
        if (modifierGroupIds.length > 0) {
          await tx.productModifierGroup.createMany({
            data: modifierGroupIds.map((groupId) => ({
              productId: id,
              modifierGroupId: groupId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          variants: true,
          unitPrices: true,
          stocks: true,
          modifierGroups: {
            include: {
              modifierGroup: true,
            },
          },
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Produk berhasil diperbarui.',
      data: updatedProduct,
    });
  } catch (error) {
    if (error.message === 'Nama produk tidak boleh kosong.') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Controller: Menghapus produk
 * DELETE /api/products/:id
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const existingProduct = await prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan atau bukan milik toko Anda.',
      });
    }

    await prisma.product.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Produk berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Update cepat stok produk untuk cabang tertentu
 * PATCH /api/products/:id/stock
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const updateProductStock = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { branchId, quantity, minStock } = req.body;

    const targetBranchId = branchId || req.activeBranchId;

    if (!targetBranchId) {
      return res.status(400).json({
        success: false,
        message: 'ID Cabang (branchId) wajib disertakan.',
      });
    }

    // Pastikan produk dan cabang adalah milik tenant yang sama
    const [product, branch] = await Promise.all([
      prisma.product.findFirst({ where: { id, tenantId } }),
      prisma.branch.findFirst({ where: { id: targetBranchId, tenantId } }),
    ]);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan.',
      });
    }

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Cabang tidak ditemukan.',
      });
    }

    const updatedStock = await prisma.productStock.upsert({
      where: {
        productId_branchId: {
          productId: id,
          branchId: targetBranchId,
        },
      },
      update: {
        ...(quantity !== undefined && { quantity: parseFloat(quantity) || 0 }),
        ...(minStock !== undefined && { minStock: parseInt(minStock, 10) || 0 }),
      },
      create: {
        productId: id,
        branchId: targetBranchId,
        quantity: parseFloat(quantity) || 0,
        minStock: parseInt(minStock, 10) || 5,
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Stok produk di ${branch.name} berhasil diperbarui.`,
      data: updatedStock,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
};
