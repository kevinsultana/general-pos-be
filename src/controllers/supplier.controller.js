import prisma from '../lib/prisma.js';

/**
 * Controller: Mendapatkan daftar seluruh supplier milik tenant
 * GET /api/suppliers
 * Protected: authenticate, requirePermission('inventory:view')
 */
export const getSuppliers = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { search = '' } = req.query;

    const where = { tenantId };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Menambahkan supplier baru
 * POST /api/suppliers
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const createSupplier = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { name, contactName, phone, email, address, notes } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama supplier/pemasok wajib diisi.',
      });
    }

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: name.trim(),
        contactName: contactName ? contactName.trim() : null,
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        notes: notes ? notes.trim() : null,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Pemasok berhasil ditambahkan.',
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Memperbarui data supplier
 * PUT /api/suppliers/:id
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const updateSupplier = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, contactName, phone, email, address, notes } = req.body;

    const existingSupplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!existingSupplier) {
      return res.status(404).json({
        success: false,
        message: 'Pemasok tidak ditemukan atau bukan milik toko Anda.',
      });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) throw new Error('Nama pemasok tidak boleh kosong.');
      updateData.name = name.trim();
    }
    if (contactName !== undefined) updateData.contactName = contactName ? contactName.trim() : null;
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (email !== undefined) updateData.email = email ? email.trim() : null;
    if (address !== undefined) updateData.address = address ? address.trim() : null;
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;

    const updated = await prisma.supplier.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Data pemasok berhasil diperbarui.',
      data: updated,
    });
  } catch (error) {
    if (error.message === 'Nama pemasok tidak boleh kosong.') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Controller: Menghapus supplier (dicegah jika memiliki riwayat PO)
 * DELETE /api/suppliers/:id
 * Protected: authenticate, requirePermission('inventory:manage')
 */
export const deleteSupplier = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Pemasok tidak ditemukan.',
      });
    }

    if (supplier._count.purchaseOrders > 0) {
      return res.status(400).json({
        success: false,
        message: `Pemasok tidak dapat dihapus karena memiliki ${supplier._count.purchaseOrders} riwayat pesanan pembelian (PO).`,
      });
    }

    await prisma.supplier.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Pemasok berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
