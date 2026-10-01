import { z } from 'zod';

/**
 * Middleware untuk validasi request payload menggunakan skema Zod.
 * Mendukung validasi req.body, req.query, atau req.params.
 *
 * @param {z.ZodSchema} schema - Skema Zod untuk memvalidasi request body atau objek { body, query, params }
 * @returns {Function} Express middleware function
 */
export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Jika skema mendefinisikan { body, query, params }
      if (schema instanceof z.ZodObject && (schema.shape.body || schema.shape.query || schema.shape.params)) {
        const parsed = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        if (parsed.body !== undefined) req.body = parsed.body;
        if (parsed.query !== undefined) req.query = parsed.query;
        if (parsed.params !== undefined) req.params = parsed.params;
      } else {
        // Default: memvalidasi req.body
        const parsedBody = await schema.parseAsync(req.body);
        req.body = parsedBody;
      }

      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map((err) => {
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
