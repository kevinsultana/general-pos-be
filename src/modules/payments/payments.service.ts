import { prisma } from '../../config/prisma.js';
import { CreatePaymentMethodInput, UpdatePaymentMethodInput } from './payments.schemas.js';

export class PaymentsService {
  static async getPaymentMethods(storeId: string, enabledOnly?: boolean) {
    return prisma.paymentMethod.findMany({
      where: {
        storeId,
        ...(enabledOnly ? { enabled: true } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async createPaymentMethod(storeId: string, input: CreatePaymentMethodInput) {
    return prisma.paymentMethod.create({
      data: {
        storeId,
        type: input.type,
        name: input.name,
        enabled: input.enabled,
        configuration: input.configuration ?? undefined,
      },
    });
  }

  static async updatePaymentMethod(storeId: string, methodId: string, input: UpdatePaymentMethodInput) {
    const existing = await prisma.paymentMethod.findFirst({
      where: { id: methodId, storeId },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Metode pembayaran tidak ditemukan' };
    }

    return prisma.paymentMethod.update({
      where: { id: methodId },
      data: input,
    });
  }
}
