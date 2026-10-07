import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../errors/AppError';

type Source = 'body' | 'params' | 'query';

// Validates req[source] against a Zod schema and stores the parsed result on res.locals.<source>,
// so handlers read typed, coerced values (Express 5 makes req.query read-only).
export const validate =
  (schema: ZodType, source: Source = 'body'): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(badRequest('Request validation failed', details));
    }
    res.locals[source] = result.data;
    next();
  };
