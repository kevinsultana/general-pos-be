import { prisma } from '../../config/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateProductInput, UpdateProductInput } from './products.schemas.js';

export class ProductsService {
  static async getProducts(
    storeId: string,
    options?: {
      categoryId?: string;
      search?: string;
      activeOnly?: boolean;
      lowStockOnly?: boolean;
    }
  ) {
    const where: any = { storeId };

    if (options?.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options?.activeOnly) {
      where.active = true;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { sku: { contains: options.search, mode: 'insensitive' } },
        { barcode: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        variants: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (options?.lowStockOnly) {
      return products.filter((p) => {
        const pStock = Number(p.stock);
        const pThreshold = Number(p.lowStockThreshold);
        if (pStock <= pThreshold) return true;

        return p.variants.some(
          (v) => Number(v.stock) <= Number(v.lowStockThreshold)
        );
      });
    }

    return products;
  }

  static async getProductById(storeId: string, productId: string) {
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
      include: {
        category: true,
        variants: true,
      },
    });

    if (!product) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
    }

    return product;
  }

  static async createProduct(
    storeId: string,
    input: CreateProductInput,
    currentUserId: string
  ) {
    // 1. Check category
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, storeId },
    });

    if (!category) {
      throw { statusCode: 400, code: 'INVALID_CATEGORY', message: 'Kategori tidak valid' };
    }

    // 2. Check SKU uniqueness
    if (input.sku) {
      const existingSku = await prisma.product.findFirst({
        where: { storeId, sku: input.sku },
      });
      if (existingSku) {
        throw { statusCode: 409, code: 'DUPLICATE_SKU', message: 'SKU produk sudah terdaftar' };
      }
    }

    // 3. Check Barcode uniqueness
    if (input.barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: { storeId, barcode: input.barcode },
      });
      if (existingBarcode) {
        throw { statusCode: 409, code: 'DUPLICATE_BARCODE', message: 'Barcode produk sudah terdaftar' };
      }
    }

    // 4. Create product with variants and optional initial stock movement
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          storeId,
          categoryId: input.categoryId,
          name: input.name,
          sku: input.sku || null,
          barcode: input.barcode || null,
          cost: input.cost,
          sellingPrice: input.sellingPrice,
          stock: input.stock,
          lowStockThreshold: input.lowStockThreshold,
          imageReference: input.imageReference,
          active: input.active,
          variants: input.variants && input.variants.length > 0
            ? {
                create: input.variants.map((v) => ({
                  name: v.name,
                  sku: v.sku || null,
                  barcode: v.barcode || null,
                  cost: v.cost,
                  sellingPrice: v.sellingPrice,
                  stock: v.stock,
                  lowStockThreshold: v.lowStockThreshold,
                  active: v.active,
                })),
              }
            : undefined,
        },
        include: {
          variants: true,
          category: true,
        },
      });

      // Record initial stock movement if stock > 0
      if (input.stock > 0) {
        await tx.stockMovement.create({
          data: {
            storeId,
            productId: created.id,
            type: 'INITIAL',
            quantityDelta: input.stock,
            unitCost: input.cost,
            reason: 'Stok Awal Produk Baru',
            createdById: currentUserId,
          },
        });
      }

      // Record initial stock for variants
      if (created.variants && created.variants.length > 0) {
        for (const v of created.variants) {
          if (Number(v.stock) > 0) {
            await tx.stockMovement.create({
              data: {
                storeId,
                productId: created.id,
                variantId: v.id,
                type: 'INITIAL',
                quantityDelta: v.stock,
                unitCost: v.cost,
                reason: `Stok Awal Varian: ${v.name}`,
                createdById: currentUserId,
              },
            });
          }
        }
      }

      return created;
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'CREATE_PRODUCT',
      entityType: 'Product',
      entityId: product.id,
      afterData: {
        name: product.name,
        sellingPrice: Number(product.sellingPrice),
        cost: Number(product.cost),
        stock: Number(product.stock),
      },
    });

    return product;
  }

  static async updateProduct(
    storeId: string,
    productId: string,
    input: UpdateProductInput,
    currentUserId: string
  ) {
    const existing = await prisma.product.findFirst({
      where: { id: productId, storeId },
      include: { variants: true },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
    }

    // Check SKU conflict
    if (input.sku && input.sku !== existing.sku) {
      const conflict = await prisma.product.findFirst({
        where: { storeId, sku: input.sku, id: { not: productId } },
      });
      if (conflict) {
        throw { statusCode: 409, code: 'DUPLICATE_SKU', message: 'SKU sudah digunakan oleh produk lain' };
      }
    }

    // Check Barcode conflict
    if (input.barcode && input.barcode !== existing.barcode) {
      const conflict = await prisma.product.findFirst({
        where: { storeId, barcode: input.barcode, id: { not: productId } },
      });
      if (conflict) {
        throw { statusCode: 409, code: 'DUPLICATE_BARCODE', message: 'Barcode sudah digunakan oleh produk lain' };
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.update({
        where: { id: productId },
        data: {
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.name ? { name: input.name } : {}),
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
          ...(input.cost !== undefined ? { cost: input.cost } : {}),
          ...(input.sellingPrice !== undefined ? { sellingPrice: input.sellingPrice } : {}),
          ...(input.stock !== undefined ? { stock: input.stock } : {}),
          ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: input.lowStockThreshold } : {}),
          ...(input.imageReference !== undefined ? { imageReference: input.imageReference } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.discontinued !== undefined ? { discontinued: input.discontinued } : {}),
        },
        include: {
          variants: true,
          category: true,
        },
      });

      // Handle variants update if provided
      if (input.variants) {
        for (const v of input.variants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                sku: v.sku || null,
                barcode: v.barcode || null,
                cost: v.cost,
                sellingPrice: v.sellingPrice,
                stock: v.stock,
                lowStockThreshold: v.lowStockThreshold,
                active: v.active,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId,
                name: v.name,
                sku: v.sku || null,
                barcode: v.barcode || null,
                cost: v.cost,
                sellingPrice: v.sellingPrice,
                stock: v.stock,
                lowStockThreshold: v.lowStockThreshold,
                active: v.active,
              },
            });
          }
        }
      }

      return prod;
    });

    // Check if price or cost changed -> record audit
    if (
      (input.sellingPrice !== undefined && Number(existing.sellingPrice) !== input.sellingPrice) ||
      (input.cost !== undefined && Number(existing.cost) !== input.cost)
    ) {
      await AuditService.record({
        storeId,
        userId: currentUserId,
        action: 'UPDATE_PRODUCT_PRICE',
        entityType: 'Product',
        entityId: productId,
        beforeData: {
          sellingPrice: Number(existing.sellingPrice),
          cost: Number(existing.cost),
        },
        afterData: {
          sellingPrice: input.sellingPrice ?? Number(existing.sellingPrice),
          cost: input.cost ?? Number(existing.cost),
        },
      });
    }

    return this.getProductById(storeId, productId);
  }

  static async deleteProduct(storeId: string, productId: string, currentUserId: string) {
    const existing = await prisma.product.findFirst({
      where: { id: productId, storeId },
      include: {
        _count: {
          select: { transactionItems: true },
        },
      },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
    }

    // If product has transaction history, soft delete by deactivating
    if (existing._count.transactionItems > 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { active: false, discontinued: true },
      });

      await AuditService.record({
        storeId,
        userId: currentUserId,
        action: 'DEACTIVATE_PRODUCT',
        entityType: 'Product',
        entityId: productId,
        reason: 'Produk memiliki riwayat transaksi, dinonaktifkan secara aman',
      });

      return { deleted: false, deactivated: true };
    }

    // Clean delete if no transaction history
    await prisma.$transaction(async (tx) => {
      await tx.stockMovement.deleteMany({ where: { productId } });
      await tx.productVariant.deleteMany({ where: { productId } });
      await tx.product.delete({ where: { id: productId } });
    });

    await AuditService.record({
      storeId,
      userId: currentUserId,
      action: 'DELETE_PRODUCT',
      entityType: 'Product',
      entityId: productId,
    });

    return { deleted: true, deactivated: false };
  }
}
