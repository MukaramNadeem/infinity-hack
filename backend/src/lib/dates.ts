import { z } from 'zod';

// Deadlines are calendar dates with no time component. They are stored as 00:00 UTC
// and always exchanged with clients as "YYYY-MM-DD".

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isRealDate(value: string): boolean {
  const d = parseDateOnly(value);
  return !Number.isNaN(d.getTime()) && formatDateOnly(d) === value; // rejects 2026-02-30
}

// Zod field: accepts "YYYY-MM-DD", outputs a Date at 00:00 UTC.
export const dateOnlySchema = z
  .string()
  .regex(DATE_ONLY, 'Must be a date in YYYY-MM-DD format')
  .refine(isRealDate, 'Not a valid calendar date')
  .transform(parseDateOnly);
