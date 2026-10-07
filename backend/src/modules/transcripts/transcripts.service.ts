import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { AppError, notFound } from '../../errors/AppError';
import { formatDateOnly } from '../../lib/dates';
import type { AuthUser } from '../../types/roles';
import { getAiProvider, type DirectoryEntry } from '../../ai';
import type { ExtractionDraft } from '../../ai/extraction.schema';
import { projectInclude, toProjectDetail } from '../projects/projects.serializer';
import { validateDraft, type ResolvedProject } from './transcripts.validation';
import type { CommitInput, TranscriptInput } from './transcripts.schemas';

// ---------------------------------------------------------------------------------------------
// Helpers

const KARACHI_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }); // en-CA -> YYYY-MM-DD

const meetingDateOf = (input: TranscriptInput) =>
  input.meetingDate ? formatDateOnly(input.meetingDate) : KARACHI_DATE.format(new Date());

const hashTranscript = (text: string) =>
  createHash('sha256').update(text.replace(/\r\n/g, '\n').trim()).digest('hex');

// Managers and developers only, without emails or password data (see ai/types.ts).
async function loadDirectory() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['MANAGER', 'DEVELOPER'] } },
    orderBy: { code: 'asc' },
  });
  const forAi: DirectoryEntry[] = users.map((u) => ({
    code: u.code,
    name: u.name,
    role: u.role as DirectoryEntry['role'],
    specialization: u.specialization,
    skills: JSON.parse(u.skills) as string[],
  }));
  return { users, forAi };
}

async function findPreviousImport(contentHash: string) {
  return prisma.transcript.findFirst({
    where: { contentHash, projects: { some: {} } },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function assertNotDuplicate(contentHash: string, force: boolean) {
  if (force) return;
  const previous = await findPreviousImport(contentHash);
  if (previous) {
    throw new AppError(
      409,
      'DUPLICATE_TRANSCRIPT',
      'This transcript was already imported. Delete its projects first, or retry with ?force=true to import it again.',
      { transcriptId: previous.id, importedAt: previous.createdAt },
    );
  }
}

// Guards against double submissions (e.g. repeated clicks) while an import is still running.
const inFlight = new Set<string>();

async function withImportLock<T>(contentHash: string, fn: () => Promise<T>): Promise<T> {
  if (inFlight.has(contentHash)) {
    throw new AppError(409, 'TRANSCRIPT_IN_PROGRESS', 'This transcript is already being processed. Please wait.');
  }
  inFlight.add(contentHash);
  try {
    return await fn();
  } finally {
    inFlight.delete(contentHash);
  }
}

function draftInvalid(draft: ExtractionDraft, issues: { path: string; message: string }[]) {
  return new AppError(
    422,
    'DRAFT_INVALID',
    'Some required information could not be resolved. Correct the draft and submit it to POST /api/transcripts/commit. Nothing was saved.',
    issues,
    { draft },
  );
}

// All-or-nothing save: the transcript record, every project and every task, or nothing.
async function saveAll(admin: AuthUser, input: TranscriptInput, contentHash: string, projects: ResolvedProject[]) {
  const { transcriptId, projectIds } = await prisma.$transaction(async (tx) => {
    const transcript = await tx.transcript.create({
      data: {
        content: input.transcript,
        contentHash,
        meetingDate: input.meetingDate ?? null,
        createdById: admin.id,
      },
    });
    const ids: string[] = [];
    for (const p of projects) {
      const created = await tx.project.create({
        data: {
          name: p.name,
          clientName: p.clientName,
          description: p.description,
          managerId: p.managerId,
          deadline: p.deadline,
          transcriptId: transcript.id,
          tasks: { create: p.tasks },
        },
        select: { id: true },
      });
      ids.push(created.id);
    }
    return { transcriptId: transcript.id, projectIds: ids };
  });

  const saved = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: projectInclude(admin),
  });
  const details = projectIds.map((id) => toProjectDetail(saved.find((p) => p.id === id)!));

  return {
    transcriptId,
    totals: {
      projects: details.length,
      tasks: details.reduce((n, p) => n + p.taskCount, 0),
      estimatedHours: details.reduce((n, p) => n + p.totalEstimatedHours, 0),
    },
    projects: details,
  };
}

// ---------------------------------------------------------------------------------------------
// Public API (all ADMIN-only, enforced by the routes)

// Preview: run the AI and validate, but save nothing.
export async function extract(input: TranscriptInput) {
  const { users, forAi } = await loadDirectory();
  const draft = await getAiProvider().extract({
    transcript: input.transcript,
    meetingDate: meetingDateOf(input),
    directory: forAi,
  });
  const result = validateDraft(draft, users);
  const previous = await findPreviousImport(hashTranscript(input.transcript));

  return {
    valid: result.ok,
    issues: result.ok ? [] : result.issues,
    draft,
    alreadyImported: previous ? { transcriptId: previous.id, importedAt: previous.createdAt } : null,
  };
}

// Save a (possibly admin-corrected) draft. Re-validated server-side; never trusts the client.
export async function commit(admin: AuthUser, input: CommitInput, force: boolean) {
  const contentHash = hashTranscript(input.transcript);
  return withImportLock(contentHash, async () => {
    await assertNotDuplicate(contentHash, force);
    const { users } = await loadDirectory();
    const result = validateDraft(input.draft, users);
    if (!result.ok) throw draftInvalid(input.draft, result.issues);
    return saveAll(admin, input, contentHash, result.projects);
  });
}

// One-click "Create from Transcript": extract + validate + save.
export async function createFromTranscript(admin: AuthUser, input: TranscriptInput, force: boolean) {
  const contentHash = hashTranscript(input.transcript);
  return withImportLock(contentHash, async () => {
    await assertNotDuplicate(contentHash, force); // before the (slow, paid) AI call
    const { users, forAi } = await loadDirectory();
    const draft = await getAiProvider().extract({
      transcript: input.transcript,
      meetingDate: meetingDateOf(input),
      directory: forAi,
    });
    const result = validateDraft(draft, users);
    if (!result.ok) throw draftInvalid(draft, result.issues);
    return saveAll(admin, input, contentHash, result.projects);
  });
}

export async function listTranscripts() {
  const transcripts = await prisma.transcript.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { id: true, name: true } },
      projects: { select: { id: true, name: true } },
    },
  });
  return transcripts.map((t) => ({
    id: t.id,
    meetingDate: t.meetingDate ? formatDateOnly(t.meetingDate) : null,
    createdAt: t.createdAt,
    createdBy: t.createdBy,
    preview: t.content.slice(0, 200),
    projects: t.projects,
  }));
}

export async function getTranscript(id: string) {
  const t = await prisma.transcript.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      projects: { select: { id: true, name: true } },
    },
  });
  if (!t) throw notFound('Transcript');
  return {
    id: t.id,
    meetingDate: t.meetingDate ? formatDateOnly(t.meetingDate) : null,
    createdAt: t.createdAt,
    createdBy: t.createdBy,
    content: t.content,
    projects: t.projects,
  };
}
