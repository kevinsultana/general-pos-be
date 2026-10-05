import { ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../lib/prisma.js';
import { s3, BUCKET, PUBLIC_URL } from '../lib/s3.js';

/**
 * GET /api/media
 * Mengambil semua file media milik tenant yang tersimpan di MinIO.
 * Mencocokkan dengan logo toko dan produk untuk mengetahui status pemakaian.
 * Mendukung filter: ?branchId=... & ?filter=ALL|USED|UNUSED
 */
export const getMediaList = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const tenantSlug = req.tenant?.slug || req.tenantId;
    const { branchId, filter = 'ALL' } = req.query;
    const activeBranchId = branchId || req.activeBranchId;

    const prefix = `tenants/${tenantSlug}/`;

    // 1. Ambil daftar file dari MinIO
    let s3Objects = [];
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        MaxKeys: 1000,
      });
      const s3Res = await s3.send(listCommand);
      s3Objects = s3Res.Contents || [];
    } catch (s3Err) {
      return res.status(502).json({
        success: false,
        message: `Gagal membaca media dari MinIO: ${s3Err.message}`,
      });
    }

    // 2. Ambil data Tenant & Produk untuk pencocokan URL
    const [tenant, products] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { logoUrl: true, name: true },
      }),
      prisma.product.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          branchId: true,
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Map URL / Key produk dan logo
    const productUrlMap = new Map();
    products.forEach((p) => {
      if (p.imageUrl) {
        productUrlMap.set(p.imageUrl, p);
      }
    });

    const tenantLogoUrl = tenant?.logoUrl || null;

    // 3. Format item media
    const mediaList = s3Objects
      .filter((obj) => obj.Key && !obj.Key.endsWith('/')) // abaikan direktori kosong
      .map((obj) => {
        const url = `${PUBLIC_URL}/${BUCKET}/${obj.Key}`;
        const filename = obj.Key.split('/').pop();
        const isLogo = tenantLogoUrl === url || (tenantLogoUrl && tenantLogoUrl.includes(obj.Key));
        const matchedProduct = productUrlMap.get(url) || Array.from(productUrlMap.values()).find((p) => p.imageUrl && p.imageUrl.includes(obj.Key));

        let usage = {
          type: 'UNUSED',
          label: 'Tidak Terpakai',
          product: null,
          branchId: null,
          branchName: null,
        };

        if (isLogo) {
          usage = {
            type: 'LOGO',
            label: 'Logo Toko',
            product: null,
            branchId: null,
            branchName: 'Semua Cabang',
          };
        } else if (matchedProduct) {
          usage = {
            type: 'PRODUCT',
            label: `Produk: ${matchedProduct.name}`,
            product: { id: matchedProduct.id, name: matchedProduct.name },
            branchId: matchedProduct.branchId,
            branchName: matchedProduct.branch?.name || 'Semua Cabang',
          };
        }

        return {
          key: obj.Key,
          filename,
          url,
          size: obj.Size || 0,
          lastModified: obj.LastModified,
          usage,
        };
      });

    // 4. Filter per cabang jika diminta
    let filtered = mediaList;
    if (activeBranchId) {
      filtered = filtered.filter((item) => {
        // Media tidak terpakai selalu tampil agar bisa dibersihkan
        if (item.usage.type === 'UNUSED') return true;
        // Logo toko selalu tampil
        if (item.usage.type === 'LOGO') return true;
        // Produk yang terkait cabang aktif atau produk global
        return !item.usage.branchId || item.usage.branchId === activeBranchId;
      });
    }

    // Filter status penggunaan
    if (filter === 'USED') {
      filtered = filtered.filter((item) => item.usage.type !== 'UNUSED');
    } else if (filter === 'UNUSED') {
      filtered = filtered.filter((item) => item.usage.type === 'UNUSED');
    }

    // Urutkan dari file terbaru
    filtered.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    const totalUsed = mediaList.filter((m) => m.usage.type !== 'UNUSED').length;
    const totalUnused = mediaList.filter((m) => m.usage.type === 'UNUSED').length;
    const totalBytes = mediaList.reduce((acc, m) => acc + m.size, 0);

    return res.status(200).json({
      success: true,
      data: {
        items: filtered,
        summary: {
          totalFiles: mediaList.length,
          totalUsed,
          totalUnused,
          totalBytes,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/media
 * Menghapus file media dari MinIO berdasarkan key.
 * Otomatis menghapus relasi imageUrl di produk atau logoUrl jika sedang terpakai.
 * Body: { key: string }
 */
export const deleteMedia = async (req, res, next) => {
  try {
    const key = req.body?.key || req.query?.key;
    const tenantSlug = req.tenant?.slug || req.tenantId;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Key file media wajib disertakan.',
      });
    }

    // Validasi isolasi tenant: key wajib berada di folder tenant bersangkutan
    const expectedPrefix = `tenants/${tenantSlug}/`;
    if (!key.startsWith(expectedPrefix)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Anda tidak diizinkan menghapus media di luar folder toko Anda.',
      });
    }

    // 1. Hapus file dari MinIO
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: key,
        })
      );
    } catch (s3Err) {
      return res.status(502).json({
        success: false,
        message: `Gagal menghapus file dari MinIO: ${s3Err.message}`,
      });
    }

    // 2. Bersihkan referensi dari database (jika ada)
    const targetUrl = `${PUBLIC_URL}/${BUCKET}/${key}`;

    // Cek logo toko
    await prisma.tenant.updateMany({
      where: {
        id: req.tenantId,
        OR: [{ logoUrl: targetUrl }, { logoUrl: { contains: key } }],
      },
      data: { logoUrl: null },
    });

    // Cek gambar produk
    await prisma.product.updateMany({
      where: {
        tenantId: req.tenantId,
        OR: [{ imageUrl: targetUrl }, { imageUrl: { contains: key } }],
      },
      data: { imageUrl: null },
    });

    return res.status(200).json({
      success: true,
      message: 'Media berhasil dihapus dari MinIO dan referensinya telah diperbarui.',
    });
  } catch (error) {
    next(error);
  }
};
