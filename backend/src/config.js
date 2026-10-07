import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
export function loadConfig(env = process.env) {
  const invalid = [];
  const required = name => { if (!env[name]?.trim()) invalid.push(name); return env[name]?.trim(); };
  const bool = (name, fallback) => { if (!env[name]) return fallback; if (!['true','false'].includes(env[name])) invalid.push(name); return env[name] === 'true'; };
  const num = (name, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => { const v = env[name] ? Number(env[name]) : fallback; if (!Number.isInteger(v) || v < min || v > max) invalid.push(name); return v; };
  const databaseUrl = required('DATABASE_URL');
  for (const name of ['DATABASE_URL', 'TEST_DATABASE_URL']) {
    if (env[name]) { try { if (!['postgres:', 'postgresql:'].includes(new URL(env[name]).protocol)) invalid.push(name); } catch { invalid.push(name); } }
  }
  const production = env.NODE_ENV === 'production';
  if (env.NODE_ENV && !['production','development','test'].includes(env.NODE_ENV)) invalid.push('NODE_ENV');
  const sessionSecret = required('SESSION_SECRET');
  if (sessionSecret && sessionSecret.length < 32) invalid.push('SESSION_SECRET');
  const provider = required('LLM_PROVIDER');
  if (!['openai','anthropic','gemini'].includes(provider)) invalid.push('LLM_PROVIDER');
  const apiKey = required('LLM_API_KEY');
  const model = required('LLM_MODEL');
  const origins = (env.CLIENT_URL || 'http://localhost:3000').split(',').map(x => x.trim());
  for (const origin of origins) { try { if (new URL(origin).origin !== origin || !/^https?:/.test(origin)) invalid.push('CLIENT_URL'); } catch { invalid.push('CLIENT_URL'); } }
  const sameSite = env.COOKIE_SAMESITE || 'lax';
  const secure = bool('COOKIE_SECURE', production);
  if (!['lax','strict','none'].includes(sameSite) || (sameSite === 'none' && !secure)) invalid.push('COOKIE_SAMESITE');
  const debugAI = bool('DEBUG_AI', false);
  if (production && debugAI) invalid.push('DEBUG_AI');
  const meetingDate = env.MEETING_DATE || '2026-10-07';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) || Number.isNaN(Date.parse(meetingDate)) || new Date(meetingDate).toISOString().slice(0,10) !== meetingDate) invalid.push('MEETING_DATE');
  const temperature = env.LLM_TEMPERATURE ? Number(env.LLM_TEMPERATURE) : undefined;
  if (temperature !== undefined && (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)) invalid.push('LLM_TEMPERATURE');
  if (env.LLM_BASE_URL) { try { if (!['http:', 'https:'].includes(new URL(env.LLM_BASE_URL).protocol)) invalid.push('LLM_BASE_URL'); } catch { invalid.push('LLM_BASE_URL'); } }
  const config = { port: num('PORT',4000,1,65535), production, databaseUrl, testDatabaseUrl: env.TEST_DATABASE_URL,
    databaseSSL: bool('DATABASE_SSL',false), databaseCA: env.DATABASE_CA_CERT?.replaceAll('\\n','\n'), sessionSecret,
    sessionTTL: num('SESSION_TTL_HOURS',8)*3600000, cookie: { httpOnly:true, secure, sameSite, path:'/' }, origins,
    provider, apiKey, model, baseUrl: env.LLM_BASE_URL?.replace(/\/$/,''), temperature, jsonMode: bool('LLM_JSON_MODE',true),
    maxOutputTokens: num('LLM_MAX_OUTPUT_TOKENS',8192), timeoutMs: num('LLM_TIMEOUT_MS',90000), maxAttempts: num('AI_MAX_ATTEMPTS',2,1,5),
    meetingDate, transcriptMaxChars:num('TRANSCRIPT_MAX_CHARS',60000), debugAI, demoPassword:env.DEMO_PASSWORD || 'Demo123!' };
  if (invalid.length) throw new Error('Missing or invalid environment variables: ' + [...new Set(invalid)].join(', '));
  return config;
}
