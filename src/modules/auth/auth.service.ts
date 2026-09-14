import { prisma } from '../../config/prisma.js';
import { comparePassword } from '../../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../../utils/jwt.js';
import { AuditService } from '../audit/audit.service.js';
import { LoginInput } from './auth.schemas.js';

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
}
