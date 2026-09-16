import { prisma } from '../../config/prisma.js';
import { CreatePrinterInput, UpdatePrinterInput } from './printers.schemas.js';

function normalizeConfiguration(config: any) {
  if (config === undefined || config === null) return undefined;
  if (typeof config === 'string') {
    const trimmed = config.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      return { raw: config };
    }
  }
  return config;
}

export class PrintersService {
  static async getPrinters(storeId: string, role?: string) {
    return prisma.printer.findMany({
      where: {
        storeId,
        ...(role ? { role: role as any } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async getPrinterById(storeId: string, printerId: string) {
    const printer = await prisma.printer.findFirst({
      where: { id: printerId, storeId },
    });

    if (!printer) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Printer tidak ditemukan' };
    }

    return printer;
  }

  static async createPrinter(storeId: string, input: CreatePrinterInput) {
    return prisma.printer.create({
      data: {
        storeId,
        name: input.name,
        connectionType: input.connectionType,
        addressReference: input.addressReference || null,
        paperSize: input.paperSize,
        role: input.role,
        receiptCopies: input.receiptCopies,
        kitchenCopies: input.kitchenCopies,
        autoPrint: input.autoPrint,
        active: input.active,
        configuration: normalizeConfiguration(input.configuration),
      },
    });
  }

  static async upsertPrinter(storeId: string, input: CreatePrinterInput & { id?: string }) {
    const printerId = input.id;
    if (printerId) {
      const existing = await prisma.printer.findFirst({
        where: { id: printerId, storeId },
      });
      if (existing) {
        return this.updatePrinter(storeId, printerId, input);
      }
      return prisma.printer.create({
        data: {
          id: printerId,
          storeId,
          name: input.name,
          connectionType: input.connectionType,
          addressReference: input.addressReference || null,
          paperSize: input.paperSize,
          role: input.role,
          receiptCopies: input.receiptCopies,
          kitchenCopies: input.kitchenCopies,
          autoPrint: input.autoPrint,
          active: input.active,
          configuration: normalizeConfiguration(input.configuration),
        },
      });
    }
    return this.createPrinter(storeId, input);
  }

  static async updatePrinter(storeId: string, printerId: string, input: UpdatePrinterInput) {
    const existing = await prisma.printer.findFirst({
      where: { id: printerId, storeId },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Printer tidak ditemukan' };
    }

    return prisma.printer.update({
      where: { id: printerId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.connectionType ? { connectionType: input.connectionType } : {}),
        ...(input.addressReference !== undefined ? { addressReference: input.addressReference } : {}),
        ...(input.paperSize ? { paperSize: input.paperSize } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.receiptCopies !== undefined ? { receiptCopies: input.receiptCopies } : {}),
        ...(input.kitchenCopies !== undefined ? { kitchenCopies: input.kitchenCopies } : {}),
        ...(input.autoPrint !== undefined ? { autoPrint: input.autoPrint } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.configuration !== undefined
          ? { configuration: normalizeConfiguration(input.configuration) ?? null }
          : {}),
      },
    });
  }

  static async deletePrinter(storeId: string, printerId: string) {
    const existing = await prisma.printer.findFirst({
      where: { id: printerId, storeId },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Printer tidak ditemukan' };
    }

    await prisma.printer.delete({
      where: { id: printerId },
    });

    return true;
  }
}
