import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuditService } from '../audit/audit.service.js';

export class SubscriptionController {
  static async getSubscription(req: Request, res: Response) {
    const storeId = req.user!.storeId;

    try {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          name: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
        },
      });

      if (!store) {
        return sendError(res, 'NOT_FOUND', 'Toko tidak ditemukan', 404);
      }

      const plan = store.subscriptionPlan;
      const isPro = plan === 'PRO';
      const isPaidOrPro = plan === 'PAID' || plan === 'PRO';

      const data = {
        storeId: store.id,
        storeName: store.name,
        plan: store.subscriptionPlan,
        status: store.subscriptionStatus,
        expiresAt: store.subscriptionExpiresAt,
        entitlements: {
          offlinePos: true,
          cloudSync: isPaidOrPro,
          multiDevice: isPaidOrPro,
          rolePermissions: isPaidOrPro,
          inventoryTracking: isPaidOrPro,
          webDashboard: isPro,
          advancedReports: isPro,
          exportData: isPro,
        },
      };

      return sendSuccess(res, data, 'Informasi langganan berhasil diambil');
    } catch (error: any) {
      return sendError(res, 'INTERNAL_SERVER_ERROR', error.message || 'Gagal mengambil data langganan', 500);
    }
  }

  static async updatePlan(req: Request, res: Response) {
    const storeId = req.user!.storeId;
    const userId = req.user!.userId;
    const { plan, durationDays } = req.body;

    if (!['FREE', 'PAID', 'PRO'].includes(plan)) {
      return sendError(res, 'INVALID_INPUT', 'Pilihan paket harus FREE, PAID, atau PRO', 400);
    }

    try {
      let expiresAt: Date | null = null;
      if (durationDays && durationDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + durationDays);
        expiresAt = d;
      }

      const updated = await prisma.store.update({
        where: { id: storeId },
        data: {
          subscriptionPlan: plan,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: expiresAt,
        },
        select: {
          id: true,
          name: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
        },
      });

      await AuditService.record({
        storeId,
        userId,
        action: 'UPDATE_SUBSCRIPTION_PLAN',
        entityType: 'Store',
        entityId: storeId,
        metadata: { newPlan: plan, durationDays },
      });

      return sendSuccess(res, updated, `Paket toko berhasil diubah menjadi ${plan}`);
    } catch (error: any) {
      return sendError(res, 'INTERNAL_SERVER_ERROR', error.message || 'Gagal memperbarui paket', 500);
    }
  }
}
