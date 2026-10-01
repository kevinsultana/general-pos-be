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

    // 1. Validasi Kelengkapan Field
    if (!storeName || !storeSlug || !ownerName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Semua field (storeName, storeSlug, ownerName, email, password) wajib diisi.',
      });
    }

    const normalizedSlug = storeSlug.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Cek apakah storeSlug sudah dipakai di tabel Tenant
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
    });

    if (existingTenant) {
      return res.status(409).json({
        success: false,
        message: 'Slug toko sudah digunakan',
      });
    }

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Eksekusi Atomic Transaction via Prisma
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 4a. Buat Tenant baru (default plan: "FREE")
      const tenant = await tx.tenant.create({
        data: {
          name: storeName.trim(),
          slug: normalizedSlug,
          plan: 'FREE',
          planStatus: 'ACTIVE',
        },
      });

      // 4b. Buat Branch otomatis ("Cabang Utama", isMain: true)
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Cabang Utama',
          isMain: true,
        },
      });

      // 4c. Buat default Role ("OWNER", permissions: ["*"])
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'OWNER',
          permissions: ['*'],
        },
      });

      // 4d. Buat User pertama (isOwner: true, relasi ke tenantId dan roleId)
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          roleId: role.id,
          name: ownerName.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          isOwner: true,
          isActive: true,
        },
      });

      // 4e. Hubungkan User ke Branch utama via UserBranch
      await tx.userBranch.create({
        data: {
          userId: user.id,
          branchId: branch.id,
        },
      });

      return { tenant, branch, role, user };
    });

    const { tenant, branch, user } = transactionResult;

    // 5. Generate JWT Token
    const token = generateToken({
      userId: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: 'OWNER',
      activeBranchId: branch.id,
      plan: tenant.plan,
    });

    // 6. Kembalikan Response 201 Created dengan data tenant lengkap
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
    const mainBranchEntry =
      user.userBranches.find((ub) => ub.branch?.isMain) || user.userBranches[0];
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

    const branches = (user.userBranches || []).map((ub) => ({
      id: ub.branch.id,
      name: ub.branch.name,
      isMain: ub.branch.isMain,
    }));

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isOwner: user.isOwner,
          isActive: user.isActive,
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
 * Controller: Memperbarui Pengaturan / Nama Toko
 * PUT /api/auth/store-settings (Protected: authenticate)
 */
export const updateStoreSettings = async (req, res, next) => {
  try {
    const { name } = req.body;
    const tenantId = req.tenantId || req.tenant?.id;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama toko wajib diisi.',
      });
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: name.trim(),
      },
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

export default {
  register,
  login,
  getMe,
  updateStoreSettings,
};
