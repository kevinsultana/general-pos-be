import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateUserInput, UpdateUserInput } from './users.schemas.js';

export class UsersService {
  static async getUsers(storeId: string) {
    return prisma.user.findMany({
      where: { storeId },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        active: true,
        role: {
          select: { id: true, name: true, isSystem: true },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async getUserById(storeId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, storeId },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        active: true,
        role: {
          select: {
            id: true,
            name: true,
            isSystem: true,
            permissions: {
              select: {
                permission: { select: { key: true, description: true } },
              },
            },
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan' };
    }

    return user;
  }

  static async createUser(storeId: string, input: CreateUserInput, currentUserId: string) {
    // Check if username already exists in this store
    const existing = await prisma.user.findFirst({
      where: { storeId, username: input.username },
    });

    if (existing) {
      throw { statusCode: 409, code: 'USERNAME_EXISTS', message: 'Username sudah digunakan di toko ini' };
    }

    // Verify role belongs to this store
    const role = await prisma.role.findFirst({
      where: { id: input.roleId, storeId },
    });

    if (!role) {
      throw { statusCode: 400, code: 'INVALID_ROLE', message: 'Role tidak ditemukan untuk toko ini' };
    }

    const passwordHash = await hashPassword(input.password);

    const newUser = await prisma.user.create({
      data: {
        storeId,
        username: input.username,
        displayName: input.displayName,
        email: input.email,
        passwordHash,
        roleId: input.roleId,
        active: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        active: true,
        role: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: newUser.id,
      afterData: { username: newUser.username, role: role.name },
    });

    return newUser;
  }

  static async updateUser(storeId: string, userId: string, input: UpdateUserInput, currentUserId: string) {
    const existing = await prisma.user.findFirst({
      where: { id: userId, storeId },
      include: { role: true },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan' };
    }

    // Owner cannot deactivate own account
    if (existing.role.name.toLowerCase() === 'owner' && input.active === false) {
      throw { statusCode: 400, code: 'CANNOT_DEACTIVATE_OWNER', message: 'Akun Owner utama tidak boleh dinonaktifkan' };
    }

    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = await hashPassword(input.password);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.roleId ? { roleId: input.roleId } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        active: true,
        role: { select: { id: true, name: true } },
        updatedAt: true,
      },
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: userId,
      beforeData: { active: existing.active, roleId: existing.roleId },
      afterData: { active: updated.active, roleId: updated.role.id },
    });

    return updated;
  }
}
