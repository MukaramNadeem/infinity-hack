import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // Listen address. 0.0.0.0 (IPv4) is reachable as both localhost and 127.0.0.1, including from a
  // Windows browser when the API runs in WSL2 (the default dual-stack bind is only forwarded as ::1).
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  OPENROUTER_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('openai/gpt-4o-mini'),
  AI_MOCK: booleanString,
  // Origin(s) allowed to call the API from a browser. Comma-separated for several,
  // e.g. "http://localhost:5173,https://novaworks-crm.example".
  FRONTEND_URL: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example.`);
}

export const env = parsed.data;
