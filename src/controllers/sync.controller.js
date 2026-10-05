import prisma from '../lib/prisma.js';

/**
 * Controller: Initial Upload Data Offline SQLite ke Cloud PostgreSQL
 * POST /api/sync/initial-upload
 */
export const initialUpload = async (req, res, next) => {
  try {
    const { tenant, user, activeBranchId } = req;
    const { categories = [], products = [], transactions = [] } = req.body;

    // Pastikan cabang aktif tersedia
    let targetBranchId = activeBranchId;
    if (!targetBranchId) {
      const mainBranch = await prisma.branch.findFirst({
        where: { tenantId: tenant.id, isMain: true },
      });
      targetBranchId = mainBranch?.id;
    }

    const syncedCategoryIds = [];
    const syncedProductIds = [];
    const syncedTransactionIds = [];

    // 1. Sinkronisasi Kategori
    for (const cat of categories) {
      try {
        const upserted = await prisma.productCategory.upsert({
          where: {
            tenantId_name: {
              tenantId: tenant.id,
              name: cat.name,
            },
          },
          update: {
            sortOrder: cat.sortOrder ?? 0,
          },
          create: {
            id: cat.id,
            tenantId: tenant.id,
            name: cat.name,
            sortOrder: cat.sortOrder ?? 0,
          },
        });
        syncedCategoryIds.push(cat.id);
      } catch (err) {
        // Abaikan atau catat log jika duplikat
        syncedCategoryIds.push(cat.id);
      }
    }

    // 2. Sinkronisasi Produk & Varian Standar
    for (const prod of products) {
      try {
        // Cek kategori apakah valid di database
        let validCategoryId = null;
        if (prod.categoryId) {
          const catExists = await prisma.productCategory.findFirst({
            where: { id: prod.categoryId, tenantId: tenant.id },
          });
          if (catExists) validCategoryId = catExists.id;
        }

        const existingProduct = await prisma.product.findUnique({
          where: { id: prod.id },
          include: { variants: true },
        });

        if (!existingProduct) {
          await prisma.product.create({
            data: {
              id: prod.id,
              tenantId: tenant.id,
              branchId: targetBranchId ?? null,
              categoryId: validCategoryId,
              name: prod.name,
              imageUrl: prod.imageUrl ?? null,
              isActive: prod.isActive ?? true,
              variants: {
                create: {
                  name: 'Regular',
                  price: prod.price,
                  costPrice: prod.costPrice ?? 0,
                },
              },
            },
          });
        } else {
          await prisma.product.update({
            where: { id: prod.id },
            data: {
              name: prod.name,
              categoryId: validCategoryId,
              isActive: prod.isActive ?? true,
            },
          });
        }
        syncedProductIds.push(prod.id);
      } catch (prodErr) {
        console.error('Error syncing product:', prodErr);
      }
    }

    // 3. Sinkronisasi Transaksi Offline ke Model Order
    for (const trx of transactions) {
      try {
        const existingOrder = await prisma.order.findFirst({
          where: {
            tenantId: tenant.id,
            orderNumber: trx.receiptNumber,
          },
        });

        if (!existingOrder && targetBranchId) {
          // Cari atau buat variant dummy untuk item transaksi
          const orderItemsData = [];
          for (const item of trx.items || []) {
            let variantId = null;
            if (item.productId) {
              const variant = await prisma.productVariant.findFirst({
                where: { productId: item.productId },
              });
              if (variant) variantId = variant.id;
            }

            // Jika variant tidak ditemukan, gunakan fallback variant pertama toko
            if (!variantId) {
              const fallbackVariant = await prisma.productVariant.findFirst({
                where: { product: { tenantId: tenant.id } },
              });
              if (fallbackVariant) variantId = fallbackVariant.id;
            }

            if (variantId) {
              orderItemsData.push({
                productVariantId: variantId,
                productName: item.productName,
                variantName: 'Regular',
                price: item.price,
                costPrice: 0,
                quantity: item.quantity,
                subtotal: item.subtotal,
                notes: item.notes ?? '',
              });
            }
          }

          if (orderItemsData.length > 0) {
            await prisma.order.create({
              data: {
                id: trx.id,
                orderNumber: trx.receiptNumber,
                tenantId: tenant.id,
                branchId: targetBranchId,
                customerName: trx.customerName || 'Pelanggan Offline',
                customerPhone: trx.customerPhone || null,
                status: 'COMPLETED',
                totalAmount: trx.totalAmount,
                notes: 'Transaksi dibuat offline dari OmniPOS Mobile',
                createdAt: trx.createdAt ? new Date(trx.createdAt) : new Date(),
                items: {
                  create: orderItemsData,
                },
              },
            });
          }
        }
        syncedTransactionIds.push(trx.id);
      } catch (trxErr) {
        console.error('Error syncing transaction:', trxErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Initial upload sinkronisasi cloud berhasil diselesaikan.',
      data: {
        syncedCategoryIds,
        syncedProductIds,
        syncedTransactionIds,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Push Transaksi Baru dari Mobile ke Server Cloud
 * POST /api/sync/push
 */
export const pushSync = async (req, res, next) => {
  return initialUpload(req, res, next);
};

/**
 * Controller: Tarik Produk & Kategori Terbaru dari Cloud ke Mobile
 * GET /api/sync/pull
 */
export const pullSync = async (req, res, next) => {
  try {
    const { tenant } = req;

    const categories = await prisma.productCategory.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const products = await prisma.product.findMany({
      where: { tenantId: tenant.id, isActive: true },
      include: {
        variants: { orderBy: { price: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedProducts = products.map((p) => {
      const mainVariant = p.variants[0];
      return {
        id: p.id,
        tenantId: p.tenantId,
        categoryId: p.categoryId,
        name: p.name,
        price: mainVariant ? Number(mainVariant.price) : 0,
        costPrice: mainVariant ? Number(mainVariant.costPrice) : 0,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        categories,
        products: formattedProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};
