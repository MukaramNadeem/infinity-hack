import cors from 'cors';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

// localhost and 127.0.0.1 are the same machine, but browsers treat them as different origins.
// Allow both spellings of every loopback origin in FRONTEND_URL, so the frontend works whichever
// address is in the browser's address bar.
const LOOPBACK = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/;

export const allowedOrigins = new Set(
  env.FRONTEND_URL.flatMap((origin) => {
    const m = origin.match(LOOPBACK);
    return m ? [`${m[1]}localhost${m[3] ?? ''}`, `${m[1]}127.0.0.1${m[3] ?? ''}`] : [origin];
  }),
);

// Browsers may call the API only from FRONTEND_URL. Requests without an Origin header
// (curl, Postman, server-to-server, same-origin Swagger UI) are not affected by CORS.
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new AppError(403, 'CORS_NOT_ALLOWED', `Origin ${origin} is not allowed. Add it to FRONTEND_URL.`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600, // cache preflight responses for 10 minutes
});
