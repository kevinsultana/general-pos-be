import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';

export interface RecordAuditParams {
  storeId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeData?: any;
  afterData?: any;
  metadata?: any;
  reason?: string;
}

export class AuditService {
  static async record(params: RecordAuditParams) {
    try {
      const mergedMetadata = params.reason
        ? { reason: params.reason, ...(params.metadata || {}) }
        : params.metadata;

      return await prisma.auditLog.create({
        data: {
          storeId: params.storeId,
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          beforeData: params.beforeData ?? undefined,
          afterData: params.afterData ?? undefined,
          metadata: mergedMetadata ?? undefined,
        },
      });
    } catch (err: any) {
      logger.error(`Failed to record audit log: ${err.message}`);
      // Audit log failure must not fail the primary business operation
      return null;
    }
  }

  static async getLogs(storeId: string, options?: { entityType?: string; userId?: string; limit?: number }) {
    const limit = options?.limit ?? 50;
    return prisma.auditLog.findMany({
      where: {
        storeId,
        ...(options?.entityType ? { entityType: options.entityType } : {}),
        ...(options?.userId ? { userId: options.userId } : {}),
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
