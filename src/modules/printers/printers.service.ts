import { prisma } from '../../config/prisma.js';
import { CreatePrinterInput, UpdatePrinterInput } from './printers.schemas.js';

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
        configuration: input.configuration ?? undefined,
      },
    });
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
        ...(input.configuration !== undefined ? { configuration: input.configuration } : {}),
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
