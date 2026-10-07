import { z } from 'zod';
import { dateOnlySchema } from '../../lib/dates';
import { extractionDraftSchema } from '../../ai/extraction.schema';

const transcriptFields = {
  transcript: z
    .string()
    .trim()
    .min(20, 'Transcript is empty or too short')
    .max(100_000, 'Transcript is too long (max 100,000 characters)'),
  // Reference date for deadlines without a year. Defaults to today (Asia/Karachi).
  meetingDate: dateOnlySchema.optional(),
};

export const transcriptInputSchema = z.strictObject(transcriptFields);

export const commitInputSchema = z.strictObject({
  ...transcriptFields,
  draft: extractionDraftSchema,
});

export const forceQuerySchema = z.object({
  force: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type TranscriptInput = z.infer<typeof transcriptInputSchema>;
export type CommitInput = z.infer<typeof commitInputSchema>;
