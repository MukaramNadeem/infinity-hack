// Meeting transcript -> projects and tasks, using the offline mock AI provider.

import { prisma } from '../src/lib/prisma';
import { setAiProvider, type AiProvider, type ExtractionRequest } from '../src/ai';
import { MockAiProvider } from '../src/ai/mockProvider';
import { AppError } from '../src/errors/AppError';
import {
  ANSWER_KEY_PROJECTS,
  ANSWER_KEY_TASKS,
  MEETING_DATE,
  SAMPLE_TRANSCRIPT,
  api,
  auth,
  counts,
  editTranscript,
  importTranscript,
  resetData,
} from './helpers';

const EMPTY = { projects: 0, tasks: 0, transcripts: 0 };

type ProjectDto = { name: string; clientName: string; deadline: string; taskCount: number; totalEstimatedHours: number; manager: { code: string }; tasks: TaskDto[] };
type TaskDto = { title: string; deadline: string; estimatedHours: number; status: string; assignee: { code: string; role: string } };

describe('Create from Transcript with the sample meeting', () => {
  let response: Awaited<ReturnType<typeof importTranscript>>;
  let projects: ProjectDto[];

  beforeAll(async () => {
    await resetData();
    response = await importTranscript();
    projects = response.body.projects;
  });

  it('returns 201 with 3 projects, 12 tasks and 124 hours', () => {
    expect(response.status).toBe(201);
    expect(response.body.totals).toEqual({ projects: 3, tasks: 12, estimatedHours: 124 });
    expect(typeof response.body.transcriptId).toBe('string');
  });

  it.each(ANSWER_KEY_PROJECTS)('creates $name as in the answer key', (expected) => {
    const project = projects.find((p) => p.name === expected.name);
    expect(project).toMatchObject({
      clientName: expected.clientName,
      deadline: expected.deadline,
      taskCount: expected.taskCount,
      totalEstimatedHours: expected.hours,
      manager: { code: expected.manager },
    });
  });

  it.each(ANSWER_KEY_TASKS)('%s / %s -> %s, due %s, %ih', (projectName, title, owner, deadline, hours) => {
    const task = projects.find((p) => p.name === projectName)?.tasks.find((t) => t.title === title);
    expect(task).toMatchObject({ assignee: { code: owner }, deadline, estimatedHours: hours, status: 'TODO' });
  });

  it('persists the records (they survive a fresh read) and links them to the transcript', async () => {
    expect(await counts()).toEqual({ projects: 3, tasks: 12, transcripts: 1 });
    const linked = await prisma.project.count({ where: { transcriptId: response.body.transcriptId } });
    expect(linked).toBe(3);
  });

  it('keeps rejected features out and never invents employees', async () => {
    const tasks = await prisma.task.findMany({ include: { assignee: true } });
    expect(tasks.filter((t) => /payment|inventory|map|tracking|email/i.test(t.title))).toEqual([]);
    expect(tasks.every((t) => t.assignee.role === 'DEVELOPER')).toBe(true);
    expect(await prisma.user.count()).toBe(10);
    expect(await prisma.user.count({ where: { name: { contains: 'Kamran' } } })).toBe(0);
  });

  it('lists the import under GET /api/transcripts and returns it by id', async () => {
    const list = await api().get('/api/transcripts').set(await auth('admin'));
    expect(list.body.transcripts).toHaveLength(1);
    expect(list.body.transcripts[0]).toMatchObject({ id: response.body.transcriptId, meetingDate: MEETING_DATE, createdBy: { name: 'Admin' } });

    const one = await api().get(`/api/transcripts/${response.body.transcriptId}`).set(await auth('admin'));
    expect(one.body.transcript.content).toBe(SAMPLE_TRANSCRIPT.trim());
    expect(one.body.transcript.projects).toHaveLength(3);

    const missing = await api().get('/api/transcripts/nope').set(await auth('admin'));
    expect(missing.status).toBe(404);
  });
});

describe('Changed-input case (challenge section 9)', () => {
  beforeEach(resetData);

  it('reflects QuickServe integration at 12 hours due 23 October, other tasks unchanged', async () => {
    const changed = editTranscript(
      'Usman owns Mobile integration and testing: 10 hours, 22 October.',
      'Usman owns Mobile integration and testing: 12 hours, 23 October.',
    );
    const res = await importTranscript(changed);

    expect(res.status).toBe(201);
    expect(res.body.totals).toEqual({ projects: 3, tasks: 12, estimatedHours: 126 });

    const tasks: (TaskDto & { project: string })[] = res.body.projects.flatMap((p: ProjectDto) =>
      p.tasks.map((t) => ({ ...t, project: p.name })),
    );
    const integration = tasks.find((t) => t.title === 'Mobile integration and testing');
    expect(integration).toMatchObject({ estimatedHours: 12, deadline: '2026-10-23', assignee: { code: 'DEV04' } });

    for (const [project, title, owner, deadline, hours] of ANSWER_KEY_TASKS) {
      if (title === 'Mobile integration and testing') continue;
      expect(tasks.find((t) => t.project === project && t.title === title)).toMatchObject({
        assignee: { code: owner },
        deadline,
        estimatedHours: hours,
      });
    }
  });
});

describe('Preview: POST /api/transcripts/extract', () => {
  beforeEach(resetData);

  it('returns a valid draft using directory codes and saves nothing', async () => {
    const res = await api().post('/api/transcripts/extract').set(await auth('admin')).send({ transcript: SAMPLE_TRANSCRIPT, meetingDate: MEETING_DATE });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valid: true, issues: [], alreadyImported: null });
    expect(res.body.draft.projects.map((p: { managerCode: string }) => p.managerCode)).toEqual(['PM01', 'PM02', 'PM03']);
    expect(await counts()).toEqual(EMPTY);
  });

  it('reports issues instead of failing when the draft is incomplete', async () => {
    const transcript = editTranscript('Zain owns Human escalation flow', 'Kamran owns Human escalation flow');
    const res = await api().post('/api/transcripts/extract').set(await auth('admin')).send({ transcript, meetingDate: MEETING_DATE });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.issues).toEqual([
      { path: 'projects.2.tasks.2.assigneeCode', message: expect.stringContaining('"Kamran" is not in the team directory') },
    ]);
  });

  it('flags a transcript that was already imported', async () => {
    const first = await importTranscript();
    const res = await api().post('/api/transcripts/extract').set(await auth('admin')).send({ transcript: SAMPLE_TRANSCRIPT });
    expect(res.body.alreadyImported).toMatchObject({ transcriptId: first.body.transcriptId });
  });
});

describe('Validation failures save nothing (all-or-nothing)', () => {
  beforeEach(resetData);

  it('unknown person -> 422 with the draft and an issue for that field; no project is saved', async () => {
    const transcript = editTranscript('Zain owns Human escalation flow', 'Kamran owns Human escalation flow');
    const res = await importTranscript(transcript);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DRAFT_INVALID');
    expect(res.body.error.details).toEqual([
      {
        path: 'projects.2.tasks.2.assigneeCode',
        message: 'Project "HelpDeskPro AI Assistant": task "Human escalation flow": "Kamran" is not in the team directory',
      },
    ]);
    expect(res.body.draft.projects).toHaveLength(3);
    // The two fully valid projects were not saved either.
    expect(await counts()).toEqual(EMPTY);
  });

  it('task due after its project -> 422', async () => {
    const transcript = editTranscript(
      'Maryam owns Assistant evaluation and testing: 8 hours, 21 October.',
      'Maryam owns Assistant evaluation and testing: 8 hours, 25 October.',
    );
    const res = await importTranscript(transcript);

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      { path: 'projects.2.tasks.3.deadline', message: expect.stringContaining('task deadline 2026-10-25 is after the project deadline 2026-10-22') },
    ]);
    expect(await counts()).toEqual(EMPTY);
  });

  it('manager named who is a developer -> 422', async () => {
    const transcript = editTranscript('manager Bilal, deadline 24 October', 'manager Sara, deadline 24 October');
    const res = await importTranscript(transcript);

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      { path: 'projects.1.managerCode', message: expect.stringContaining('Sara Noor is a DEVELOPER, expected a MANAGER') },
    ]);
  });

  it('transcript without any projects -> 422', async () => {
    const res = await importTranscript('We discussed the weather and lunch plans for next week. Nothing else.');
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([{ path: 'projects', message: 'No projects were found in the transcript' }]);
  });

  it('AI service failure -> 502 and nothing saved', async () => {
    setAiProvider({
      name: 'failing',
      extract: async () => {
        throw new AppError(502, 'AI_UNAVAILABLE', 'The AI service timed out. Please try again.');
      },
    });
    const res = await importTranscript();

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
    expect(await counts()).toEqual(EMPTY);
  });
});

describe('Correction flow: POST /api/transcripts/commit', () => {
  const kamranTranscript = editTranscript('Zain owns Human escalation flow', 'Kamran owns Human escalation flow');

  beforeEach(resetData);

  async function rejectedDraft() {
    const res = await importTranscript(kamranTranscript);
    expect(res.status).toBe(422);
    return res.body.draft;
  }

  it('saves the draft once the admin fixes the unresolved field', async () => {
    const draft = await rejectedDraft();
    draft.projects[2].tasks[2].assigneeCode = 'DEV05';

    const res = await api().post('/api/transcripts/commit').set(await auth('admin')).send({ transcript: kamranTranscript, meetingDate: MEETING_DATE, draft });

    expect(res.status).toBe(201);
    expect(res.body.totals).toEqual({ projects: 3, tasks: 12, estimatedHours: 124 });
    const escalation = await prisma.task.findFirstOrThrow({ where: { title: 'Human escalation flow' }, include: { assignee: true } });
    expect(escalation.assignee.name).toBe('Zain Abbas');
  });

  it('re-validates the submitted draft on the server', async () => {
    const draft = await rejectedDraft();
    draft.projects[2].tasks[2].assigneeCode = 'DEV05';
    draft.projects[0].managerCode = 'DEV01';
    draft.projects[1].tasks[0].deadline = '2026-11-30';
    draft.projects[1].tasks[1].estimatedHours = 0;

    const res = await api().post('/api/transcripts/commit').set(await auth('admin')).send({ transcript: kamranTranscript, draft });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((i: { path: string }) => i.path)).toEqual([
      'projects.0.managerCode',
      'projects.1.tasks.0.deadline',
      'projects.1.tasks.1.estimatedHours',
    ]);
    expect(await counts()).toEqual(EMPTY);
  });

  it('accepts people by full name as well as by code', async () => {
    const draft = await rejectedDraft();
    draft.projects[2].tasks[2].assigneeCode = 'Zain Abbas';
    const res = await api().post('/api/transcripts/commit').set(await auth('admin')).send({ transcript: kamranTranscript, draft });
    expect(res.status).toBe(201);
  });

  it('is admin-only', async () => {
    const draft = await rejectedDraft();
    const res = await api().post('/api/transcripts/commit').set(await auth('hina')).send({ transcript: kamranTranscript, draft });
    expect(res.status).toBe(403);
  });
});

describe('Duplicate protection', () => {
  beforeEach(resetData);

  it('rejects importing the same transcript twice with 409', async () => {
    const first = await importTranscript();
    const second = await importTranscript();

    expect(second.status).toBe(409);
    expect(second.body.error).toMatchObject({ code: 'DUPLICATE_TRANSCRIPT', details: { transcriptId: first.body.transcriptId } });
    expect(await counts()).toEqual({ projects: 3, tasks: 12, transcripts: 1 });
  });

  it('allows a deliberate re-import with ?force=true', async () => {
    await importTranscript();
    const again = await importTranscript(SAMPLE_TRANSCRIPT, '?force=true');
    expect(again.status).toBe(201);
    expect(await counts()).toEqual({ projects: 6, tasks: 24, transcripts: 2 });
  });

  it('allows re-importing after the generated projects were deleted', async () => {
    await importTranscript();
    await prisma.project.deleteMany();
    const again = await importTranscript();
    expect(again.status).toBe(201);
  });

  it('accepts only one of two simultaneous submissions (double click)', async () => {
    const mock = new MockAiProvider();
    setAiProvider({
      name: 'slow-mock',
      extract: async (req) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return mock.extract(req);
      },
    });

    const results = await Promise.all([importTranscript(), importTranscript()]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('TRANSCRIPT_IN_PROGRESS');
    expect(await counts()).toEqual({ projects: 3, tasks: 12, transcripts: 1 });
  });
});

describe('What the AI is given', () => {
  beforeEach(resetData);

  it('receives managers and developers only, without emails or passwords', async () => {
    let captured: ExtractionRequest | undefined;
    const mock = new MockAiProvider();
    const spy: AiProvider = {
      name: 'spy',
      extract: async (req) => {
        captured = req;
        return mock.extract(req);
      },
    };
    setAiProvider(spy);

    await importTranscript();

    expect(captured!.meetingDate).toBe(MEETING_DATE);
    expect(captured!.transcript).toBe(SAMPLE_TRANSCRIPT.trim());
    expect(captured!.directory).toHaveLength(9);
    expect(captured!.directory.map((d) => d.code)).not.toContain('ADMIN');
    for (const entry of captured!.directory) {
      expect(Object.keys(entry).sort()).toEqual(['code', 'name', 'role', 'skills', 'specialization']);
    }
    expect(JSON.stringify(captured)).not.toMatch(/@novaworks|Demo123|\$2[aby]\$/);
  });
});
