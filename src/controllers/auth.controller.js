import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateToken } from '../lib/jwt.js';

/**
 * Helper: Format standar objek tenant lengkap untuk konsistensi API
 */
const formatTenant = (tenant) => {
  if (!tenant) return null;
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    planStatus: tenant.planStatus,
    billingCycle: tenant.billingCycle,
    subscriptionExpiresAt: tenant.subscriptionExpiresAt,
    proJoinedAt: tenant.proJoinedAt,
    logoUrl: tenant.logoUrl ?? null,
    receiptShowLogo: tenant.receiptShowLogo ?? true,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
};

/**
 * Controller: Registrasi Tenant Toko & Akun Pemilik (First User)
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { storeName, storeSlug, ownerName, email, password } = req.body;

    // 1. Validasi Kelengkapan Field Dasar
    if (!storeName || !storeSlug || !ownerName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Semua field (storeName, storeSlug, ownerName, email, password) wajib diisi.',
      });
    }

    const cleanStoreName = typeof storeName === 'string' ? storeName.trim() : '';
    const cleanOwnerName = typeof ownerName === 'string' ? ownerName.trim() : '';
    const normalizedSlug = typeof storeSlug === 'string' ? storeSlug.toLowerCase().trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';

    if (!cleanStoreName || !cleanOwnerName) {
      return res.status(400).json({
        success: false,
        message: 'Nama toko dan nama pemilik tidak boleh kosong.',
      });
    }

    // 2. Validasi Format storeSlug: regex /^[a-z0-9]+(?:-[a-z0-9]+)*$/ (3 - 30 karakter)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (
      normalizedSlug.length < 3 ||
      normalizedSlug.length > 30 ||
      !slugRegex.test(normalizedSlug)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Format slug toko tidak valid. Harus 3-30 karakter, hanya huruf kecil, angka, dan tanda hubung (-).',
      });
    }

    // 3. Validasi Format Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Format alamat email tidak valid.',
      });
    }

    // 4. Validasi Panjang Password (minimal 8 karakter)
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Kata sandi minimal 8 karakter.',
      });
    }

    // 5. Cek apakah storeSlug sudah dipakai di tabel Tenant
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
    });

    if (existingTenant) {
      return res.status(409).json({
        success: false,
        message: 'Slug toko sudah digunakan',
      });
    }

    // 6. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7. Eksekusi Atomic Transaction via Prisma
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 7a. Buat Tenant baru (default plan: "FREE")
      const tenant = await tx.tenant.create({
        data: {
          name: cleanStoreName,
          slug: normalizedSlug,
          plan: 'FREE',
          planStatus: 'ACTIVE',
        },
      });

      // 7b. Buat Branch otomatis ("Cabang Utama", isMain: true)
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Cabang Utama',
          isMain: true,
        },
      });

      // 7c. Buat role OWNER (satu-satunya role bawaan sistem)
      // Tenant bebas membuat role kustom sendiri (KASIR, MANAGER, dll.) lewat halaman Kelola Peran
      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'OWNER',
          description: 'Pemilik Toko dengan akses penuh tanpa batas ke seluruh sistem',
          permissions: ['*'],
          isSystem: true,
        },
      });

      // 7d. Buat User pertama (isOwner: true, relasi ke tenantId dan roleId)
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          roleId: ownerRole.id,
          name: cleanOwnerName,
          email: normalizedEmail,
          password: hashedPassword,
          isOwner: true,
          isActive: true,
        },
      });

      // 7e. Hubungkan User ke Branch utama via UserBranch
      await tx.userBranch.create({
        data: {
          userId: user.id,
          branchId: branch.id,
        },
      });

      return { tenant, branch, role: ownerRole, user };
    });

    const { tenant, branch, user } = transactionResult;

    // 8. Generate JWT Token
    const token = generateToken({
      userId: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: 'OWNER',
      activeBranchId: branch.id,
      plan: tenant.plan,
    });

    // 9. Kembalikan Response 201 Created dengan data tenant lengkap
    return res.status(201).json({
      success: true,
      message: 'Registrasi toko dan akun pemilik berhasil',
      data: {
        token,
        tenant: formatTenant(tenant),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isOwner: user.isOwner,
        },
        branch: {
          id: branch.id,
          name: branch.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Login Pengguna berdasarkan Store Slug & Kredensial
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { storeSlug, email, password, clientType = 'web' } = req.body;

    // 1. Validasi Input
    if (!storeSlug || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'storeSlug, email, dan password wajib diisi.',
      });
    }

    const normalizedSlug = storeSlug.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Cari Tenant berdasarkan slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Toko tidak ditemukan',
      });
    }

    // 3. Cari User di dalam tenant tersebut
    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: normalizedEmail,
        },
      },
      include: {
        role: true,
        userBranches: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Kredensial tidak valid',
      });
    }

    // Cek status keaktifan user
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'USER_INACTIVE',
        message: 'Akun pengguna dinonaktifkan oleh administrator toko.',
      });
    }

    // 4. Bandingkan Password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Kredensial tidak valid',
      });
    }

    // 5. Dapatkan Cabang Aktif User (utamakan cabang utama)
    const userBranches = user.userBranches || [];
    const mainBranchEntry =
      userBranches.find((ub) => ub.branch?.isMain) || userBranches[0];
    const activeBranch = mainBranchEntry ? mainBranchEntry.branch : null;

    // 6. Buat JWT Token
    const token = generateToken({
      userId: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: user.role?.name || 'KASIR',
      activeBranchId: activeBranch?.id || null,
      plan: tenant.plan,
    });

    // 7. Kembalikan Response 200 OK dengan data tenant lengkap
    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        tenant: formatTenant(tenant),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isOwner: user.isOwner,
          role: user.role?.name || null,
        },
        activeBranch: activeBranch
          ? {
              id: activeBranch.id,
              name: activeBranch.name,
              isMain: activeBranch.isMain,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Mendapatkan Profil Pengguna Saat Ini (Protected)
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    const { user, tenant, activeBranchId } = req;

    let branches = [];
    if (user.isOwner || user.allBranchesAccess) {
      const allTenantBranches = await prisma.branch.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          isMain: true,
          address: true,
          phone: true,
        },
      });
      branches = allTenantBranches;
    } else {
      const userBranchEntries = await prisma.userBranch.findMany({
        where: { userId: user.id },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              isMain: true,
              address: true,
              phone: true,
              isActive: true,
            },
          },
        },
      });

      branches = userBranchEntries
        .filter((ub) => ub.branch && ub.branch.isActive)
        .map((ub) => ({
          id: ub.branch.id,
          name: ub.branch.name,
          isMain: ub.branch.isMain,
          address: ub.branch.address,
          phone: ub.branch.phone,
        }));
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isOwner: user.isOwner,
          isActive: user.isActive,
          allBranchesAccess: user.allBranchesAccess,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          planStatus: tenant.planStatus,
          billingCycle: tenant.billingCycle,
          subscriptionExpiresAt: tenant.subscriptionExpiresAt,
          proJoinedAt: tenant.proJoinedAt,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
        },
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              permissions: user.role.permissions,
            }
          : null,
        activeBranchId,
        branches,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Memperbarui Pengaturan / Nama Toko + toggle logo struk
 * PUT /api/auth/store-settings (Protected: authenticate)
 */
export const updateStoreSettings = async (req, res, next) => {
  try {
    const { name, receiptShowLogo } = req.body;
    const tenantId = req.tenantId || req.tenant?.id;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama toko wajib diisi.',
      });
    }

    const data = { name: name.trim() };
    if (typeof receiptShowLogo === 'boolean') {
      data.receiptShowLogo = receiptShowLogo;
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    return res.status(200).json({
      success: true,
      message: 'Pengaturan toko berhasil diperbarui.',
      data: {
        tenant: formatTenant(updatedTenant),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Upload Logo Toko ke MinIO
 * POST /api/auth/store-logo  (Protected: authenticate, settings:manage)
 * Multipart field: logo (image/png | image/jpeg | image/webp, ≤ 2 MB)
 */
export const uploadStoreLogo = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;

    // req.uploadedUrl is set by uploadLogoToMinIO middleware
    if (!req.uploadedUrl) {
      return res.status(400).json({ success: false, message: 'Upload gagal — file tidak ditemukan.' });
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: req.uploadedUrl },
    });

    return res.status(200).json({
      success: true,
      message: 'Logo toko berhasil diunggah.',
      data: { tenant: formatTenant(updatedTenant) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Hapus Logo Toko
 * DELETE /api/auth/store-logo  (Protected: authenticate, settings:manage)
 */
export const deleteStoreLogo = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: null },
    });

    return res.status(200).json({
      success: true,
      message: 'Logo toko berhasil dihapus.',
      data: { tenant: formatTenant(updatedTenant) },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  getMe,
  updateStoreSettings,
  uploadStoreLogo,
  deleteStoreLogo,
};
