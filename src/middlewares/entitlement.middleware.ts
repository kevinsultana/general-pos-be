import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { sendError } from '../utils/response.js';

export type PlanTier = 'FREE' | 'PAID' | 'PRO';

const PLAN_LEVELS: Record<PlanTier, number> = {
  FREE: 0,
  PAID: 1,
  PRO: 2,
};

declare global {
  namespace Express {
    interface Request {
      storePlan?: PlanTier;
    }
  }
}

/**
 * Middleware to enforce subscription plan requirement.
 * @param minimumPlan 'PAID' for cloud sync, 'PRO' for web dashboard & advanced analytics.
 */
export function requirePlan(minimumPlan: PlanTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const storeId = req.user?.storeId;

    if (!storeId) {
      return sendError(res, 'UNAUTHORIZED', 'Informasi toko tidak ditemukan dalam token', 401);
    }

    try {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: {
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
        },
      });

      if (!store) {
        return sendError(res, 'NOT_FOUND', 'Toko tidak ditemukan', 404);
      }

      // Check expiration if set
      if (
        store.subscriptionStatus === 'EXPIRED' ||
        (store.subscriptionExpiresAt && store.subscriptionExpiresAt < new Date())
      ) {
        return sendError(
          res,
          'SUBSCRIPTION_EXPIRED',
          'Langganan toko Anda telah kedaluwarsa. Silakan perbarui paket langganan Anda.',
          403,
          { currentPlan: store.subscriptionPlan, status: 'EXPIRED' }
        );
      }

      const currentLevel = PLAN_LEVELS[store.subscriptionPlan as PlanTier] ?? 0;
      const requiredLevel = PLAN_LEVELS[minimumPlan];

      if (currentLevel < requiredLevel) {
        return sendError(
          res,
          'UPGRADE_REQUIRED',
          `Fitur ini memerlukan paket langganan minimal "${minimumPlan}". Paket Anda saat ini adalah "${store.subscriptionPlan}".`,
          403,
          {
            currentPlan: store.subscriptionPlan,
            requiredPlan: minimumPlan,
          }
        );
      }

      req.storePlan = store.subscriptionPlan as PlanTier;
      next();
    } catch (error: any) {
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Gagal memvalidasi status langganan', 500);
    }
  };
}
