import { prisma } from '../../config/prisma.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../../utils/jwt.js';
import { AuditService } from '../audit/audit.service.js';
import { SYSTEM_PERMISSIONS } from '../../config/permissions.js';
import { LoginInput, RegisterStoreInput } from './auth.schemas.js';

export class AuthService {
  static async login(input: LoginInput) {
    // 1. Find user by username (and optional storeId)
    const user = await prisma.user.findFirst({
      where: {
        username: input.username,
        ...(input.storeId ? { storeId: input.storeId } : {}),
      },
      include: {
        store: true,
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Username atau password salah' };
    }

    if (!user.active) {
      throw { statusCode: 403, code: 'ACCOUNT_INACTIVE', message: 'Akun ini telah dinonaktifkan oleh administrator' };
    }

    // 2. Verify password
    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Username atau password salah' };
    }

    // 3. Extract permissions list
    const permissions = user.role.permissions.map((rp) => rp.permission.key);

    // 4. Generate JWT Access and Refresh tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      storeId: user.storeId,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user.id, storeId: user.storeId });

    // 5. Record Audit log
    await AuditService.record({
      storeId: user.storeId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      metadata: { username: user.username, role: user.role.name },
    });

    return {
      accessToken,
      refreshToken,
      permissions,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        storeId: user.storeId,
        storeName: user.store.name,
        role: {
          id: user.role.id,
          name: user.role.name,
          isSystem: user.role.isSystem,
        },
        permissions,
      },
    };
  }

  static async refreshToken(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (!user || !user.active) {
        throw { statusCode: 401, code: 'UNAUTHORIZED', message: 'Pengguna tidak ditemukan atau tidak aktif' };
      }

      const permissions = user.role.permissions.map((rp) => rp.permission.key);

      const tokenPayload: TokenPayload = {
        userId: user.id,
        storeId: user.storeId,
        roleId: user.roleId,
        roleName: user.role.name,
        permissions,
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken({ userId: user.id, storeId: user.storeId });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (err: any) {
      if (err.statusCode) throw err;
      throw { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token tidak valid atau telah kedaluwarsa' };
    }
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        store: true,
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'Data pengguna tidak ditemukan' };
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.key);

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      store: user.store,
      role: {
        id: user.role.id,
        name: user.role.name,
        isSystem: user.role.isSystem,
      },
      permissions,
    };
  }

  static async logout(userId: string, storeId: string) {
    await AuditService.record({
      storeId,
      userId,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: userId,
    });
    return true;
  }

  static async registerStore(input: RegisterStoreInput) {
    const existingUser = await prisma.user.findFirst({
      where: { username: input.username },
    });
    if (existingUser) {
      throw {
        statusCode: 400,
        code: 'USERNAME_TAKEN',
        message: 'Username sudah digunakan, silakan pilih username lain',
      };
    }

    const passwordHash = await hashPassword(input.password);

    const result = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          id: input.storeId,
          name: input.storeName,
          ownerName: input.ownerName,
          phone: input.phone,
          address: input.address,
          email: input.email,
          subscriptionPlan: 'PRO',
          subscriptionStatus: 'ACTIVE',
        },
      });

      let allPermissions = await tx.permission.findMany();
      if (allPermissions.length === 0) {
        for (const perm of SYSTEM_PERMISSIONS) {
          await tx.permission.create({
            data: { key: perm.key, description: perm.description },
          });
        }
        allPermissions = await tx.permission.findMany();
      }

      const ownerRole = await tx.role.create({
        data: {
          storeId: store.id,
          name: 'Owner',
          description: 'Pemilik Toko dengan hak akses penuh ke seluruh fitur dan pengaturan',
          isSystem: true,
        },
      });

      for (const perm of allPermissions) {
        await tx.rolePermission.create({
          data: { roleId: ownerRole.id, permissionId: perm.id },
        });
      }

      const adminRole = await tx.role.create({
        data: {
          storeId: store.id,
          name: 'Admin',
          description: 'Manajer Toko untuk manajemen produk, inventori, laporan, dan promosi',
          isSystem: true,
        },
      });
      const adminPermissionKeys = [
        'view_store', 'view_users', 'manage_products', 'view_products',
        'manage_categories', 'manage_inventory', 'view_inventory',
        'create_transaction', 'view_sales', 'cancel_transaction',
        'refund_transaction', 'manage_customers', 'manage_promotions',
        'view_promotions', 'manage_printers', 'view_reports',
        'view_audit_logs', 'sync_data',
      ];
      for (const perm of allPermissions.filter((p) => adminPermissionKeys.includes(p.key))) {
        await tx.rolePermission.create({
          data: { roleId: adminRole.id, permissionId: perm.id },
        });
      }

      const cashierRole = await tx.role.create({
        data: {
          storeId: store.id,
          name: 'Cashier',
          description: 'Kasir untuk input transaksi, melihat produk, dan mencetak struk',
          isSystem: true,
        },
      });
      const cashierPermissionKeys = [
        'view_store', 'view_products', 'create_transaction',
        'view_sales', 'manage_customers', 'view_promotions',
        'manage_printers', 'sync_data',
      ];
      for (const perm of allPermissions.filter((p) => cashierPermissionKeys.includes(p.key))) {
        await tx.rolePermission.create({
          data: { roleId: cashierRole.id, permissionId: perm.id },
        });
      }

      const user = await tx.user.create({
        data: {
          storeId: store.id,
          username: input.username,
          displayName: input.ownerName || input.username,
          email: input.email,
          passwordHash,
          roleId: ownerRole.id,
          active: true,
        },
      });

      const paymentMethods = [
        { type: 'CASH' as const, name: 'Tunai' },
        { type: 'QRIS' as const, name: 'QRIS' },
        { type: 'TRANSFER' as const, name: 'Transfer Bank' },
        { type: 'DEBIT' as const, name: 'Kartu Debit' },
        { type: 'CREDIT' as const, name: 'Kartu Kredit' },
      ];
      for (const pm of paymentMethods) {
        await tx.paymentMethod.create({
          data: {
            storeId: store.id,
            type: pm.type,
            name: pm.name,
            enabled: true,
          },
        });
      }

      await tx.category.create({
        data: {
          storeId: store.id,
          name: 'Umum',
          active: true,
        },
      });

      const permissions = allPermissions.map((p) => p.key);
      const tokenPayload: TokenPayload = {
        userId: user.id,
        storeId: user.storeId,
        roleId: user.roleId,
        roleName: ownerRole.name,
        permissions,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken({ userId: user.id, storeId: user.storeId });

      return {
        accessToken,
        refreshToken,
        permissions,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: {
            id: ownerRole.id,
            name: ownerRole.name,
          },
        },
        store: {
          id: store.id,
          name: store.name,
          plan: store.subscriptionPlan,
          status: store.subscriptionStatus,
        },
      };
    });

    await AuditService.record({
      storeId: result.store.id,
      userId: result.user.id,
      action: 'REGISTER_STORE',
      entityType: 'Store',
      entityId: result.store.id,
      metadata: { storeName: result.store.name, ownerUsername: result.user.username },
    });

    return result;
  }
}
