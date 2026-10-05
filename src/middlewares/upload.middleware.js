/**
 * upload.middleware.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MinIO / S3-compatible multipart parser (no temporary disk storage).
 * Streams uploads directly to MinIO and exposes the public URL on `req.uploadedUrl`.
 *
 * Multi-tenant structure:
 *   - Logo Toko:   <MINIO_PUBLIC_URL>/<MINIO_BUCKET>/tenants/<tenantSlug>/logos/<filename>
 *   - Gambar Menu: <MINIO_PUBLIC_URL>/<MINIO_BUCKET>/tenants/<tenantSlug>/products/<filename>
 *
 * Env vars required (see .env):
 *   MINIO_ENDPOINT   – hostname only, e.g. "100.110.43.25" or "minio.yourdomain.com"
 *   MINIO_PORT       – default 9000
 *   MINIO_USE_SSL    – "true" | "false"  (default false for local)
 *   MINIO_ACCESS_KEY – MinIO root / service-account access key
 *   MINIO_SECRET_KEY – MinIO root / service-account secret key
 *   MINIO_BUCKET     – bucket name, e.g. "omnipos"
 *   MINIO_PUBLIC_URL – Base URL the browser uses to load images.
 */

import { PutObjectCommand } from '@aws-sdk/client-s3';
import busboy from 'busboy';
import { s3, BUCKET, PUBLIC_URL } from '../lib/s3.js';
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Factory for MinIO streaming multipart upload middleware.
 * Partitions storage per tenant: tenants/<tenantSlug>/<folder>/...
 *
 * @param {object} options
 * @param {string} options.folder - subfolder under tenant ("logos" | "products")
 * @param {string[]} options.fieldNames - valid multipart field names (e.g. ['logo'] or ['image', 'file'])
 * @param {string} options.prefix - file prefix (e.g. 'logo' or 'prod')
 * @param {number} options.maxBytes - maximum file size in bytes
 */
export function createMinIOUploader({
  folder = 'products',
  fieldNames = ['image', 'file'],
  prefix = 'prod',
  maxBytes = 3 * 1024 * 1024,
} = {}) {
  const allowedFieldNames = new Set(fieldNames);

  return (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return next(Object.assign(new Error('Request harus berupa multipart/form-data.'), { status: 400 }));
    }

    let uploaded = false;
    let totalBytes = 0;

    try {
      const bb = busboy({ headers: req.headers, limits: { fileSize: maxBytes, files: 1 } });

      bb.on('file', (fieldname, stream, info) => {
        if (!allowedFieldNames.has(fieldname)) {
          stream.resume(); // discard non-target fields
          return;
        }

        const { mimeType } = info;
        if (!ALLOWED_MIME.has(mimeType)) {
          stream.resume();
          return next(Object.assign(
            new Error('Format file tidak didukung. Gunakan format PNG, JPEG, atau WebP.'),
            { status: 400 }
          ));
        }

        const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
        const tenantSlug = req.tenant?.slug || req.tenantId || 'common';
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const filename = `tenants/${tenantSlug}/${folder}/${prefix}-${Date.now()}-${randomSuffix}${ext}`;

        const chunks = [];
        stream.on('data', (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            stream.destroy();
            return next(Object.assign(
              new Error(`Ukuran file melebihi batas ${Math.round(maxBytes / (1024 * 1024))} MB.`),
              { status: 413 }
            ));
          }
          chunks.push(chunk);
        });

        stream.on('end', async () => {
          if (uploaded) return; // guard double-fire
          uploaded = true;
          try {
            const body = Buffer.concat(chunks);
            await s3.send(new PutObjectCommand({
              Bucket: BUCKET,
              Key: filename,
              Body: body,
              ContentType: mimeType,
              // ponytail: public access governed by MinIO bucket policy
            }));
            req.uploadedUrl = `${PUBLIC_URL}/${BUCKET}/${filename}`;
            next();
          } catch (err) {
            next(Object.assign(new Error(`Upload ke MinIO gagal: ${err.message}`), { status: 502 }));
          }
        });

        stream.on('error', (err) => next(err));
      });

      bb.on('fieldsLimit', () => {});
      bb.on('filesLimit', () => next(Object.assign(new Error('Hanya 1 file yang dapat diunggah per request.'), { status: 400 })));
      bb.on('error', (err) => next(err));
      bb.on('finish', () => {
        if (!uploaded) {
          next(Object.assign(new Error(`Field file (${fieldNames.join(' / ')}) tidak ditemukan dalam request.`), { status: 400 }));
        }
      });

      req.pipe(bb);
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware upload logo toko ke MinIO:
 * Disimpan di `tenants/<tenantSlug>/logos/logo-...`
 * Frontend sudah kompres ke ≤300 KB — limit server 1 MB sebagai safety net.
 */
export const uploadLogoToMinIO = createMinIOUploader({
  folder: 'logos',
  fieldNames: ['logo', 'file'],
  prefix: 'logo',
  maxBytes: 1 * 1024 * 1024, // 1 MB safety net
});

/**
 * Middleware upload gambar produk ke MinIO:
 * Disimpan di `tenants/<tenantSlug>/products/prod-...`
 * Frontend sudah kompres ke ≤300 KB — limit server 1 MB sebagai safety net.
 */
export const uploadProductImageToMinIO = createMinIOUploader({
  folder: 'products',
  fieldNames: ['image', 'file'],
  prefix: 'prod',
  maxBytes: 1 * 1024 * 1024, // 1 MB safety net
});

export default {
  createMinIOUploader,
  uploadLogoToMinIO,
  uploadProductImageToMinIO,
};
