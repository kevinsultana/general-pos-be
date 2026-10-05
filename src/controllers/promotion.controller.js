import prisma from '../lib/prisma.js';

/**
 * GET /api/promotions
 * Ambil semua promo milik tenant (dan cabang jika difilter).
 * Kasir (POS) hanya butuh yang aktif, berlaku hari ini, dan sesuai cabang kasir.
 * Query: ?activeOnly=true&branchId=uuid
 */
export const getPromotions = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { activeOnly, branchId: queryBranchId } = req.query;
    const targetBranchId = queryBranchId || req.activeBranchId || null;

    const now = new Date();
    const where = { tenantId };

    if (activeOnly === 'true') {
      where.isActive = true;

      // POS kasir: tampilkan promo yang berlaku untuk cabang aktif ini
      if (targetBranchId) {
        where.branchId = targetBranchId;
      }

      // Filter rentang tanggal masa berlaku
      where.AND = [
        {
          OR: [{ startDate: null }, { startDate: { lte: now } }],
        },
        {
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      ];
    } else if (queryBranchId) {
      // Halaman manajemen: filter by cabang tertentu
      where.branchId = queryBranchId;
    }

    const promotions = await prisma.promotion.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Urutkan manual: promo spesifik cabang (branchId != null) naik ke atas,
    // kemudian promo global (branchId = null), lalu sort by createdAt desc
    promotions.sort((a, b) => {
      const aHasBranch = a.branchId !== null ? 1 : 0;
      const bHasBranch = b.branchId !== null ? 1 : 0;
      if (bHasBranch !== aHasBranch) return bHasBranch - aHasBranch;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return res.json({
      success: true,
      data: promotions.map(serializePromotion),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/promotions/:id
 * Detail satu promo
 */
export const getPromotionById = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const promo = await prisma.promotion.findFirst({
      where: { id, tenantId },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promo tidak ditemukan.' });
    }

    return res.json({ success: true, data: serializePromotion(promo) });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/promotions
 * Buat promo baru (dengan opsi branchId untuk kuota per cabang)
 */
export const createPromotion = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const {
      branchId,
      name,
      code,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minPurchase,
      scope,
      scopeVariantIds,
      usageLimit,
      isActive,
      startDate,
      endDate,
    } = req.body;

    // Validasi wajib
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Nama promo wajib diisi.' });
    }
    if (!code?.trim()) {
      return res.status(400).json({ success: false, message: 'Kode promo wajib diisi.' });
    }
    if (!['PERCENTAGE', 'FIXED'].includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Tipe diskon tidak valid.' });
    }
    if (!discountValue || Number(discountValue) <= 0) {
      return res.status(400).json({ success: false, message: 'Nilai diskon harus lebih dari 0.' });
    }
    if (discountType === 'PERCENTAGE' && Number(discountValue) > 100) {
      return res.status(400).json({ success: false, message: 'Diskon persentase tidak boleh lebih dari 100%.' });
    }

    // branchId wajib — promo selalu terikat ke satu cabang
    if (!branchId || branchId === 'ALL' || branchId === 'GLOBAL') {
      return res.status(400).json({
        success: false,
        message: 'Promo harus terikat ke cabang tertentu. Pilih cabang yang berlaku.',
      });
    }
    const cleanBranchId = branchId;
    const branchExists = await prisma.branch.findFirst({
      where: { id: cleanBranchId, tenantId },
    });
    if (!branchExists) {
      return res.status(400).json({ success: false, message: 'Cabang yang dipilih tidak valid.' });
    }

    // Pastikan kode unik per tenant dan cabang
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    const existing = await prisma.promotion.findFirst({
      where: {
        tenantId,
        code: cleanCode,
        branchId: cleanBranchId,
      },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Kode promo "${cleanCode}" sudah digunakan untuk cabang ini. Gunakan kode lain.`,
      });
    }

    const promo = await prisma.promotion.create({
      data: {
        tenantId,
        branchId: cleanBranchId,
        name: name.trim(),
        code: cleanCode,
        description: description?.trim() || null,
        discountType,
        discountValue: parseFloat(discountValue),
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
        scope: scope || 'ALL',
        scopeVariantIds: scope === 'PRODUCT' && Array.isArray(scopeVariantIds)
          ? scopeVariantIds
          : null,
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        isActive: isActive !== false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({ success: true, data: serializePromotion(promo) });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/promotions/:id
 * Update promo
 */
export const updatePromotion = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const {
      branchId,
      name,
      code,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minPurchase,
      scope,
      scopeVariantIds,
      usageLimit,
      isActive,
      startDate,
      endDate,
    } = req.body;

    const existing = await prisma.promotion.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Promo tidak ditemukan.' });
    }

    // branchId tidak boleh diubah ke global — harus selalu spesifik ke satu cabang
    let effectiveBranchId = existing.branchId;
    if (branchId !== undefined) {
      if (!branchId || branchId === 'ALL' || branchId === 'GLOBAL') {
        return res.status(400).json({
          success: false,
          message: 'Promo harus terikat ke cabang tertentu. Tidak dapat mengubah ke "Semua Cabang".',
        });
      }
      effectiveBranchId = branchId;
      const branchExists = await prisma.branch.findFirst({
        where: { id: effectiveBranchId, tenantId },
      });
      if (!branchExists) {
        return res.status(400).json({ success: false, message: 'Cabang tidak valid.' });
      }
    }

    // Validasi kode unik jika diubah
    const cleanCode = code ? code.trim().toUpperCase().replace(/\s+/g, '') : existing.code;
    const conflict = await prisma.promotion.findFirst({
      where: {
        tenantId,
        code: cleanCode,
        branchId: effectiveBranchId,
        NOT: { id },
      },
    });
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: `Kode promo "${cleanCode}" sudah digunakan untuk cabang ini.`,
      });
    }

    const effectiveDiscountType = discountType || existing.discountType;
    const effectiveScope = scope || existing.scope;

    const updated = await prisma.promotion.update({
      where: { id },
      data: {
        branchId: effectiveBranchId,
        name: name?.trim() || existing.name,
        code: cleanCode,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        discountType: effectiveDiscountType,
        discountValue: discountValue !== undefined ? parseFloat(discountValue) : existing.discountValue,
        maxDiscount: maxDiscount !== undefined ? (maxDiscount ? parseFloat(maxDiscount) : null) : existing.maxDiscount,
        minPurchase: minPurchase !== undefined ? parseFloat(minPurchase) : existing.minPurchase,
        scope: effectiveScope,
        scopeVariantIds: effectiveScope === 'PRODUCT' && Array.isArray(scopeVariantIds)
          ? scopeVariantIds
          : (effectiveScope === 'ALL' ? null : existing.scopeVariantIds),
        usageLimit: usageLimit !== undefined ? (usageLimit ? parseInt(usageLimit, 10) : null) : existing.usageLimit,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    return res.json({ success: true, data: serializePromotion(updated) });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/promotions/:id/toggle
 * Toggle aktif / nonaktif promo
 */
export const togglePromotion = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const existing = await prisma.promotion.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Promo tidak ditemukan.' });
    }

    const updated = await prisma.promotion.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    return res.json({ success: true, data: serializePromotion(updated) });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/promotions/:id
 * Hapus promo
 */
export const deletePromotion = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const existing = await prisma.promotion.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Promo tidak ditemukan.' });
    }

    await prisma.promotion.delete({ where: { id } });

    return res.json({ success: true, message: 'Promo berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Helper: serialize nilai Decimal Prisma ke number JS biasa
 */
function serializePromotion(p) {
  return {
    ...p,
    branchId: p.branchId || null,
    branch: p.branch ? { id: p.branch.id, name: p.branch.name } : null,
    discountValue: Number(p.discountValue),
    maxDiscount: p.maxDiscount !== null ? Number(p.maxDiscount) : null,
    minPurchase: Number(p.minPurchase),
    scopeVariantIds: p.scopeVariantIds || [],
    startDate: p.startDate?.toISOString() || null,
    endDate: p.endDate?.toISOString() || null,
    createdAt: p.createdAt?.toISOString(),
    updatedAt: p.updatedAt?.toISOString(),
  };
}
