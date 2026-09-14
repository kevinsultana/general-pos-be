import { prisma } from '../../config/prisma.js';
import { CreateCategoryInput, UpdateCategoryInput } from './categories.schemas.js';

export class CategoriesService {
  static async getCategories(storeId: string) {
    return prisma.category.findMany({
      where: { storeId },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async getCategoryById(storeId: string, categoryId: string) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, storeId },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Kategori tidak ditemukan' };
    }

    return category;
  }

  static async createCategory(storeId: string, input: CreateCategoryInput) {
    const existing = await prisma.category.findFirst({
      where: { storeId, name: input.name },
    });

    if (existing) {
      throw { statusCode: 409, code: 'DUPLICATE_CATEGORY', message: 'Kategori dengan nama ini sudah ada' };
    }

    return prisma.category.create({
      data: {
        storeId,
        name: input.name,
        active: input.active,
      },
    });
  }

  static async updateCategory(storeId: string, categoryId: string, input: UpdateCategoryInput) {
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, storeId },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Kategori tidak ditemukan' };
    }

    return prisma.category.update({
      where: { id: categoryId },
      data: input,
    });
  }

  static async deleteCategory(storeId: string, categoryId: string) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, storeId },
      include: { _count: { select: { products: true } } },
    });

    if (!category) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Kategori tidak ditemukan' };
    }

    if (category._count.products > 0) {
      throw {
        statusCode: 400,
        code: 'CATEGORY_IN_USE',
        message: `Kategori tidak dapat dihapus karena masih digunakan oleh ${category._count.products} produk`,
      };
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    return true;
  }
}
