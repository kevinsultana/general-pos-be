import prisma from '../lib/prisma.js';

/**
 * GET /api/customers
 * Mendapatkan daftar pelanggan milik tenant dengan pencarian dan pagination
 * Query: search, page, limit
 */
export const getCustomers = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { search = '', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = { tenantId };

    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { transactions: true },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: customers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customers/:id
 * Detail pelanggan beserta riwayat transaksi terakhir
 */
export const getCustomerById = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            items: true,
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan.',
      });
    }

    return res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/customers
 * Daftarkan pelanggan baru (Nama wajib, No HP unik per tenant jika diisi)
 */
export const createCustomer = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { name, phone, email, address, notes } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama pelanggan wajib diisi.',
      });
    }

    const cleanPhone = phone ? String(phone).trim() : null;
    const cleanEmail = email ? String(email).toLowerCase().trim() : null;

    // Cek duplikasi nomor telepon pada tenant ini jika nomor telepon diisi
    if (cleanPhone) {
      const existing = await prisma.customer.findUnique({
        where: {
          tenantId_phone: {
            tenantId,
            phone: cleanPhone,
          },
        },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Pelanggan dengan nomor telepon "${cleanPhone}" sudah terdaftar (${existing.name}).`,
          data: existing,
        });
      }
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name: name.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Pelanggan berhasil ditambahkan.',
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/customers/:id
 * Perbarui data pelanggan
 */
export const updateCustomer = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, phone, email, address, notes } = req.body;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan.',
      });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Nama pelanggan tidak boleh kosong.',
        });
      }
      updateData.name = name.trim();
    }

    if (phone !== undefined) {
      const cleanPhone = phone ? String(phone).trim() : null;
      if (cleanPhone && cleanPhone !== customer.phone) {
        const existing = await prisma.customer.findUnique({
          where: {
            tenantId_phone: {
              tenantId,
              phone: cleanPhone,
            },
          },
        });
        if (existing && existing.id !== id) {
          return res.status(409).json({
            success: false,
            message: `Nomor telepon "${cleanPhone}" sudah digunakan oleh pelanggan lain (${existing.name}).`,
          });
        }
      }
      updateData.phone = cleanPhone;
    }

    if (email !== undefined) {
      updateData.email = email ? String(email).toLowerCase().trim() : null;
    }
    if (address !== undefined) {
      updateData.address = address?.trim() || null;
    }
    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null;
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Data pelanggan berhasil diperbarui.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/customers/:id
 * Hapus data pelanggan
 */
export const deleteCustomer = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan.',
      });
    }

    await prisma.customer.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Pelanggan berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
