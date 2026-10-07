import { prisma } from '../src/lib/prisma';
import { extractionDraftSchema } from '../src/ai/extraction.schema';
import { validateDraft } from '../src/modules/transcripts/transcripts.validation';
import { api, auth, resetData, userIdByCode } from './helpers';

type Detail = { path: string; message: string };
const paths = (body: { error: { details: Detail[] } }) => body.error.details.map((d) => d.path);

describe('Request validation (400 VALIDATION_ERROR with per-field details)', () => {
  let ids: Record<string, string>;

  beforeAll(async () => {
    await resetData();
    ids = Object.fromEntries(await Promise.all(['PM01', 'DEV01', 'DEV02'].map(async (c) => [c, await userIdByCode(c)])));
  });

  const project = (overrides: Record<string, unknown> = {}) => ({
    name: 'Internal tools',
    clientName: 'NovaWorks',
    managerId: ids.PM01,
    deadline: '2026-10-20',
    ...overrides,
  });
  const task = (overrides: Record<string, unknown> = {}) => ({
    title: 'Build it',
    assigneeId: ids.DEV01,
    deadline: '2026-10-15',
    estimatedHours: 5,
    ...overrides,
  });
  const createProject = async (body: unknown) => api().post('/api/projects').set(await auth('admin')).send(body as object);

  describe('transcripts', () => {
    it.each([
      ['an empty transcript', { transcript: '   ' }, 'transcript'],
      ['a missing transcript', {}, 'transcript'],
      ['a non-date meetingDate', { transcript: 'x'.repeat(50), meetingDate: '7 Oct 2026' }, 'meetingDate'],
      ['an unknown field', { transcript: 'x'.repeat(50), autoApprove: true }, ''],
    ])('rejects %s', async (_label, body, path) => {
      const res = await api().post('/api/transcripts').set(await auth('admin')).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(paths(res.body)).toContain(path);
      expect(await prisma.transcript.count()).toBe(0);
    });

    it('rejects a structurally malformed draft on commit', async () => {
      const res = await api().post('/api/transcripts/commit').set(await auth('admin')).send({ transcript: 'x'.repeat(50), draft: { projects: 'nope' } });
      expect(res.status).toBe(400);
      expect(paths(res.body)).toEqual(['draft.projects']);
    });
  });

  describe('projects', () => {
    it.each([
      ['a missing name', { name: '' }, ['name']],
      ['a malformed date', { deadline: '20/10/2026' }, ['deadline']],
      ['an impossible date', { deadline: '2026-02-30' }, ['deadline']],
      ['an unknown field', { budget: 5000 }, ['']],
    ])('rejects %s', async (_label, overrides, expected) => {
      const res = await createProject(project(overrides));
      expect(res.status).toBe(400);
      expect(paths(res.body)).toEqual(expected);
    });

    it('rejects a task with zero hours', async () => {
      const res = await createProject(project({ tasks: [task({ estimatedHours: 0 })] }));
      expect(res.status).toBe(400);
      expect(paths(res.body)).toEqual(['tasks.0.estimatedHours']);
    });

    it('enforces roles and deadlines, reporting every problem at once', async () => {
      const res = await createProject(
        project({ managerId: ids.DEV01, tasks: [task({ assigneeId: ids.PM01, deadline: '2026-10-25' }), task({ assigneeId: 'no-such-user' })] }),
      );
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([
        { path: 'managerId', message: 'Ali Raza is a DEVELOPER, expected a MANAGER' },
        { path: 'tasks.0.assigneeId', message: 'Ayesha Khan is a MANAGER, expected a DEVELOPER' },
        { path: 'tasks.1.assigneeId', message: 'No user with id "no-such-user"' },
        { path: 'tasks.0.deadline', message: 'Task deadline 2026-10-25 is after the project deadline 2026-10-20' },
      ]);
      expect(await prisma.project.count()).toBe(0);
    });

    it('rejects an empty PATCH and a deadline earlier than existing tasks', async () => {
      const created = await createProject(project({ tasks: [task({ deadline: '2026-10-18' })] }));
      const id = created.body.project.id;

      const empty = await api().patch(`/api/projects/${id}`).set(await auth('admin')).send({});
      expect(empty.status).toBe(400);

      const tooEarly = await api().patch(`/api/projects/${id}`).set(await auth('admin')).send({ deadline: '2026-10-10' });
      expect(tooEarly.status).toBe(400);
      expect(tooEarly.body.error.details[0].message).toContain('move those task deadlines first');
    });
  });

  describe('tasks', () => {
    let taskId: string;

    beforeAll(async () => {
      const created = await createProject(project({ name: 'Task validation', tasks: [task()] }));
      taskId = created.body.project.tasks[0].id;
    });

    it.each([
      ['an invalid status', { status: 'FINISHED' }, ['status']],
      ['negative hours', { estimatedHours: -2 }, ['estimatedHours']],
      ['an empty body', {}, ['']],
      ['an unknown field', { priority: 'HIGH' }, ['']],
    ])('rejects %s', async (_label, body, expected) => {
      const res = await api().patch(`/api/tasks/${taskId}`).set(await auth('admin')).send(body);
      expect(res.status).toBe(400);
      expect(paths(res.body)).toEqual(expected);
    });

    it('rejects reassigning to a non-developer and moving past the project deadline', async () => {
      const toManager = await api().patch(`/api/tasks/${taskId}`).set(await auth('admin')).send({ assigneeId: ids.PM01 });
      const tooLate = await api().patch(`/api/tasks/${taskId}`).set(await auth('admin')).send({ deadline: '2026-10-21' });
      expect([toManager.status, tooLate.status]).toEqual([400, 400]);
    });

    it('rejects invalid list filters', async () => {
      const res = await api().get('/api/tasks?status=LATE').set(await auth('admin'));
      expect(res.status).toBe(400);
    });
  });
});

describe('validateDraft (unit)', () => {
  const users = [
    { id: 'u-pm1', code: 'PM01', name: 'Ayesha Khan', role: 'MANAGER' },
    { id: 'u-d1', code: 'DEV01', name: 'Ali Raza', role: 'DEVELOPER' },
    { id: 'u-d2', code: 'DEV02', name: 'Ali Hassan', role: 'DEVELOPER' },
  ];
  const draft = (project: Record<string, unknown> = {}, tasks: Record<string, unknown>[] = [{}]) =>
    extractionDraftSchema.parse({
      projects: [
        {
          name: 'P',
          clientName: 'C',
          description: null,
          managerCode: 'PM01',
          deadline: '2026-10-20',
          ...project,
          tasks: tasks.map((t) => ({ title: 'T', description: null, assigneeCode: 'DEV01', deadline: '2026-10-10', estimatedHours: 4, ...t })),
        },
      ],
    });

  it('resolves codes to user ids and dates to Date objects', () => {
    const result = validateDraft(draft(), users);
    expect(result).toEqual({
      ok: true,
      projects: [
        {
          name: 'P',
          clientName: 'C',
          description: '',
          managerId: 'u-pm1',
          deadline: new Date('2026-10-20T00:00:00.000Z'),
          tasks: [{ title: 'T', description: '', assigneeId: 'u-d1', deadline: new Date('2026-10-10T00:00:00.000Z'), estimatedHours: 4 }],
        },
      ],
    });
  });

  it('accepts a full name or a unique first name in place of a code', () => {
    expect(validateDraft(draft({ managerCode: 'Ayesha' }, [{ assigneeCode: 'ali raza' }]), users).ok).toBe(true);
  });

  it('reports an ambiguous first name instead of guessing', () => {
    const result = validateDraft(draft({}, [{ assigneeCode: 'Ali' }]), users);
    expect(result).toEqual({ ok: false, issues: [{ path: 'projects.0.tasks.0.assigneeCode', message: expect.stringContaining('matches more than one person') }] });
  });

  it('reports every null/missing required field', () => {
    const result = validateDraft(
      draft({ name: null, clientName: '  ', managerCode: null, deadline: null }, [{ title: null, assigneeCode: null, deadline: null, estimatedHours: null }]),
      users,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.path)).toEqual([
        'projects.0.name',
        'projects.0.clientName',
        'projects.0.managerCode',
        'projects.0.deadline',
        'projects.0.tasks.0.title',
        'projects.0.tasks.0.assigneeCode',
        'projects.0.tasks.0.deadline',
        'projects.0.tasks.0.estimatedHours',
      ]);
    }
  });

  it('rejects invalid calendar dates from the AI', () => {
    const result = validateDraft(draft({ deadline: '2026-13-01' }), users);
    expect(result).toEqual({ ok: false, issues: [{ path: 'projects.0.deadline', message: expect.stringContaining('not a valid YYYY-MM-DD date') }] });
  });

  it('coerces numeric strings for hours (some models return "12")', () => {
    expect(extractionDraftSchema.parse({ projects: [{ tasks: [{ estimatedHours: '12' }] }] }).projects[0].tasks[0].estimatedHours).toBe(12);
  });
});
