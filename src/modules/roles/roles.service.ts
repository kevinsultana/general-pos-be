import { prisma } from '../../config/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateRoleInput, UpdateRoleInput } from './roles.schemas.js';

export class RolesService {
  static async getPermissions() {
    return prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });
  }

  static async getRoles(storeId: string) {
    const roles = await prisma.role.findMany({
      where: { storeId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { isSystem: 'desc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.key),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  static async getRoleById(storeId: string, roleId: string) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, storeId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Role tidak ditemukan' };
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissions: role.permissions.map((p) => p.permission.key),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  static async createRole(storeId: string, input: CreateRoleInput, currentUserId: string) {
    // 1. Verify permissions exist
    const validPermissions = await prisma.permission.findMany({
      where: { key: { in: input.permissions } },
    });

    if (validPermissions.length !== input.permissions.length) {
      throw { statusCode: 400, code: 'INVALID_PERMISSIONS', message: 'Satu atau lebih hak akses yang dipilih tidak valid' };
    }

    // 2. Create role & rolePermissions in a transaction
    const newRole = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          storeId,
          name: input.name,
          description: input.description,
          isSystem: false,
        },
      });

      for (const perm of validPermissions) {
        await tx.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }

      return role;
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'CREATE_ROLE',
      entityType: 'Role',
      entityId: newRole.id,
      afterData: { name: input.name, permissions: input.permissions },
    });

    return this.getRoleById(storeId, newRole.id);
  }

  static async updateRole(storeId: string, roleId: string, input: UpdateRoleInput, currentUserId: string) {
    const existing = await prisma.role.findFirst({
      where: { id: roleId, storeId },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Role tidak ditemukan' };
    }

    // System roles (Owner, Admin, Cashier) cannot be renamed
    if (existing.isSystem && input.name && input.name !== existing.name) {
      throw { statusCode: 400, code: 'CANNOT_MODIFY_SYSTEM_ROLE_NAME', message: 'Nama peran sistem tidak dapat diubah' };
    }

    await prisma.$transaction(async (tx) => {
      if (input.name || input.description !== undefined) {
        await tx.role.update({
          where: { id: roleId },
          data: {
            ...(input.name ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
          },
        });
      }

      // Update permissions if provided (and not Owner role)
      if (input.permissions && existing.name.toLowerCase() !== 'owner') {
        const validPermissions = await tx.permission.findMany({
          where: { key: { in: input.permissions } },
        });

        // Clear existing permissions
        await tx.rolePermission.deleteMany({
          where: { roleId },
        });

        // Insert new permissions
        for (const perm of validPermissions) {
          await tx.rolePermission.create({
            data: {
              roleId,
              permissionId: perm.id,
            },
          });
        }
      }
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'UPDATE_ROLE',
      entityType: 'Role',
      entityId: roleId,
      beforeData: { name: existing.name },
      afterData: input,
    });

    return this.getRoleById(storeId, roleId);
  }

  static async deleteRole(storeId: string, roleId: string, currentUserId: string) {
    const existing = await prisma.role.findFirst({
      where: { id: roleId, storeId },
      include: { _count: { select: { users: true } } },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Role tidak ditemukan' };
    }

    if (existing.isSystem) {
      throw { statusCode: 400, code: 'CANNOT_DELETE_SYSTEM_ROLE', message: 'Role bawaan sistem tidak boleh dihapus' };
    }

    if (existing._count.users > 0) {
      throw {
        statusCode: 400,
        code: 'ROLE_IN_USE',
        message: `Role tidak dapat dihapus karena masih digunakan oleh ${existing._count.users} pengguna`,
      };
    }

    await prisma.role.delete({
      where: { id: roleId },
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'DELETE_ROLE',
      entityType: 'Role',
      entityId: roleId,
      beforeData: { name: existing.name },
    });

    return true;
  }
}
