import prisma from '../lib/prisma.js';

/**
 * Controller: Mendapatkan seluruh Modifier Group & Options milik tenant
 * GET /api/modifiers
 * Protected: authenticate, requirePermission('inventory:view')
 */
export const getModifiers = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const modifierGroups = await prisma.modifierGroup.findMany({
      where: { tenantId },
      include: {
        options: {
          include: {
            inventoryProduct: {
              select: {
                id: true,
                name: true,
                sku: true,
                basePrice: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: modifierGroups,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Membuat Modifier Group beserta Opsi-opsinya
 * POST /api/modifiers
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const createModifier = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { name, isRequired = false, isMultiple = false, options = [] } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama grup modifier wajib diisi.',
      });
    }

    const createdGroup = await prisma.$transaction(async (tx) => {
      const group = await tx.modifierGroup.create({
        data: {
          tenantId,
          name: name.trim(),
          isRequired: Boolean(isRequired),
          isMultiple: Boolean(isMultiple),
        },
      });

      if (Array.isArray(options) && options.length > 0) {
        await tx.modifierOption.createMany({
          data: options.map((opt) => ({
            modifierGroupId: group.id,
            name: (opt.name || '').trim() || 'Opsi',
            price: Math.max(0, parseInt(opt.price, 10) || 0),
            trackStock: Boolean(opt.trackStock),
            inventoryProductId: opt.inventoryProductId || null,
            deductQty: Math.max(0.01, parseFloat(opt.deductQty) || 1),
          })),
        });
      }

      return tx.modifierGroup.findUnique({
        where: { id: group.id },
        include: {
          options: {
            include: {
              inventoryProduct: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: 'Grup modifier berhasil dibuat.',
      data: createdGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Memperbarui Modifier Group dan Opsi-opsinya
 * PUT /api/modifiers/:id
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const updateModifier = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, isRequired, isMultiple, options } = req.body;

    const existingGroup = await prisma.modifierGroup.findFirst({
      where: { id, tenantId },
    });

    if (!existingGroup) {
      return res.status(404).json({
        success: false,
        message: 'Grup modifier tidak ditemukan atau bukan milik toko Anda.',
      });
    }

    const updatedGroup = await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (name !== undefined) {
        if (!name.trim()) throw new Error('Nama grup modifier tidak boleh kosong.');
        updateData.name = name.trim();
      }
      if (isRequired !== undefined) updateData.isRequired = Boolean(isRequired);
      if (isMultiple !== undefined) updateData.isMultiple = Boolean(isMultiple);

      if (Object.keys(updateData).length > 0) {
        await tx.modifierGroup.update({
          where: { id },
          data: updateData,
        });
      }

      // Jika array options disertakan, perbarui options
      if (Array.isArray(options)) {
        await tx.modifierOption.deleteMany({
          where: { modifierGroupId: id },
        });

        if (options.length > 0) {
          await tx.modifierOption.createMany({
            data: options.map((opt) => ({
              modifierGroupId: id,
              name: (opt.name || '').trim() || 'Opsi',
              price: Math.max(0, parseInt(opt.price, 10) || 0),
              trackStock: Boolean(opt.trackStock),
              inventoryProductId: opt.inventoryProductId || null,
              deductQty: Math.max(0.01, parseFloat(opt.deductQty) || 1),
            })),
          });
        }
      }

      return tx.modifierGroup.findUnique({
        where: { id },
        include: {
          options: {
            include: {
              inventoryProduct: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Grup modifier berhasil diperbarui.',
      data: updatedGroup,
    });
  } catch (error) {
    if (error.message === 'Nama grup modifier tidak boleh kosong.') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Controller: Menghapus Modifier Group
 * DELETE /api/modifiers/:id
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const deleteModifier = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const existingGroup = await prisma.modifierGroup.findFirst({
      where: { id, tenantId },
    });

    if (!existingGroup) {
      return res.status(404).json({
        success: false,
        message: 'Grup modifier tidak ditemukan atau bukan milik toko Anda.',
      });
    }

    await prisma.modifierGroup.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Grup modifier berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getModifiers,
  createModifier,
  updateModifier,
  deleteModifier,
};
