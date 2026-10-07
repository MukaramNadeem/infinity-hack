import type { ExtractionDraft } from './extraction.schema';

// What the AI is allowed to know about each employee. Deliberately excludes email and
// password data — only what is needed to match names in the meeting to directory entries.
export interface DirectoryEntry {
  code: string; // e.g. PM01, DEV03 — the reference the AI must return
  name: string;
  role: 'MANAGER' | 'DEVELOPER';
  specialization: string;
  skills: string[];
}

export interface ExtractionRequest {
  transcript: string;
  meetingDate: string; // YYYY-MM-DD — reference for dates without a year
  directory: DirectoryEntry[];
}

// A provider turns a transcript into a structurally valid draft (shape checked with Zod).
// Business validation (people exist, dates line up, hours > 0) happens afterwards in
// modules/transcripts/transcripts.validation.ts, independent of the provider.
export interface AiProvider {
  readonly name: string;
  extract(request: ExtractionRequest): Promise<ExtractionDraft>;
}
