import { z } from 'zod';

// Shape of an extraction draft — what the AI returns, what /extract sends to the client,
// and what the client sends back (possibly corrected) to /commit.
// Fields are nullable on purpose: the AI must answer `null` instead of guessing, and
// validation then reports those fields as unresolved so the admin can correct them.

const nullableText = z
  .string()
  .nullish()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed ? trimmed : null;
  });

// Models sometimes return numbers as strings ("12"); accept those.
const nullableHours = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v),
  z.number().nullish().transform((v) => v ?? null),
);

export const draftTaskSchema = z.object({
  title: nullableText,
  description: nullableText,
  assigneeCode: nullableText,
  deadline: nullableText,
  estimatedHours: nullableHours,
});

export const draftProjectSchema = z.object({
  name: nullableText,
  clientName: nullableText,
  description: nullableText,
  managerCode: nullableText,
  deadline: nullableText,
  tasks: z.array(draftTaskSchema).max(200).default([]),
});

export const extractionDraftSchema = z.object({
  projects: z.array(draftProjectSchema).max(50),
});

export type DraftTask = z.infer<typeof draftTaskSchema>;
export type DraftProject = z.infer<typeof draftProjectSchema>;
export type ExtractionDraft = z.infer<typeof extractionDraftSchema>;

// JSON Schema sent to the model (OpenAI "strict" structured-output compatible:
// every property required, no additional properties, nullability via type unions).
const nullable = (description: string) => ({ type: ['string', 'null'], description });

export const extractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['projects'],
  properties: {
    projects: {
      type: 'array',
      description: 'One entry per client project agreed in the meeting.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'clientName', 'description', 'managerCode', 'deadline', 'tasks'],
        properties: {
          name: nullable('Project name as agreed in the meeting.'),
          clientName: nullable('Client company name.'),
          description: nullable('1-3 sentences: agreed scope and explicit exclusions.'),
          managerCode: nullable('Directory `code` of the project manager (must be a MANAGER), or null if unclear.'),
          deadline: nullable('Final project deadline, YYYY-MM-DD, or null if not stated.'),
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'description', 'assigneeCode', 'deadline', 'estimatedHours'],
              properties: {
                title: nullable('Short task title as named in the meeting.'),
                description: nullable('1-2 sentences describing the agreed task scope.'),
                assigneeCode: nullable('Directory `code` of the owner (must be a DEVELOPER), or null if unclear or not in the directory.'),
                deadline: nullable('Final task deadline, YYYY-MM-DD, or null if not stated.'),
                estimatedHours: {
                  type: ['number', 'null'],
                  description: 'Final agreed developer effort in hours, or null if not stated.',
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
