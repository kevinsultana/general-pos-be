import { z } from 'zod';

/**
 * Middleware untuk validasi request payload menggunakan skema Zod.
 * [M-1] Simplified: selalu validasi req.body, kecuali skema explicitly mendefinisikan
 * shape dengan key 'body', 'query', atau 'params' (multi-target schema).
 *
 * @param {z.ZodSchema} schema - Skema Zod untuk memvalidasi request body
 * @returns {Function} Express middleware function
 */
export const validate = (schema) => {
  // Deteksi apakah ini multi-target schema ({ body, query, params })
  const isMultiTarget =
    schema instanceof z.ZodObject &&
    Object.keys(schema.shape || {}).some((k) => ['body', 'query', 'params'].includes(k));

  return async (req, res, next) => {
    try {
      if (isMultiTarget) {
        const parsed = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        if (parsed.body !== undefined) req.body = parsed.body;
        if (parsed.query !== undefined) req.query = parsed.query;
        if (parsed.params !== undefined) req.params = parsed.params;
      } else {
        // Default: selalu validasi req.body — tidak ada fragile instanceof check
        req.body = await schema.parseAsync(req.body);
      }

      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map((err) => {
          // Bersihkan prefix 'body' yang mungkin muncul dari multi-target schema
          const fieldPath = err.path.filter((p) => p !== 'body').join('.');
          return {
            field: fieldPath || 'root',
            message: err.message,
            code: err.code,
          };
        });

        const firstMessage = formattedErrors[0]?.message || 'Input yang dimasukkan tidak valid.';

        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: `Validasi gagal: ${firstMessage}`,
          errors: formattedErrors,
        });
      }

      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: error.message || 'Permintaan tidak dapat diproses.',
      });
    }
  };
};

export default validate;
