import cors from 'cors';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

// Browsers may call the API only from FRONTEND_URL. Requests without an Origin header
// (curl, Postman, server-to-server, same-origin Swagger UI) are not affected by CORS.
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || env.FRONTEND_URL.includes(origin)) return callback(null, true);
    callback(new AppError(403, 'CORS_NOT_ALLOWED', `Origin ${origin} is not allowed. Add it to FRONTEND_URL.`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600, // cache preflight responses for 10 minutes
});
