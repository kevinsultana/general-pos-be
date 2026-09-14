import { prisma } from '../../config/prisma.js';
import { CreateCustomerInput, UpdateCustomerInput } from './customers.schemas.js';

export class CustomersService {
  static async getCustomers(storeId: string, search?: string) {
    const where: any = { storeId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.customer.findMany({
      where,
      include: {
        _count: { select: { transactions: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async getCustomerById(storeId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, storeId },
      include: {
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            transactionNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Pelanggan tidak ditemukan' };
    }

    return customer;
  }

  static async createCustomer(storeId: string, input: CreateCustomerInput) {
    return prisma.customer.create({
      data: {
        storeId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
      },
    });
  }

  static async updateCustomer(storeId: string, customerId: string, input: UpdateCustomerInput) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, storeId },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Pelanggan tidak ditemukan' };
    }

    return prisma.customer.update({
      where: { id: customerId },
      data: input,
    });
  }

  static async deleteCustomer(storeId: string, customerId: string) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, storeId },
      include: { _count: { select: { transactions: true } } },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Pelanggan tidak ditemukan' };
    }

    if (existing._count.transactions > 0) {
      throw {
        statusCode: 400,
        code: 'CUSTOMER_HAS_TRANSACTIONS',
        message: 'Pelanggan memiliki riwayat transaksi dan tidak dapat dihapus',
      };
    }

    await prisma.customer.delete({
      where: { id: customerId },
    });

    return true;
  }
}
