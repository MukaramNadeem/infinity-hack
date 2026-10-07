// Role-based access for ADMIN, MANAGER and DEVELOPER, against data generated from the
// sample transcript. Out-of-scope projects/tasks must return 404 (not just be hidden in lists).

import { prisma } from '../src/lib/prisma';
import { api, auth, importTranscript, resetData, type DemoLogin } from './helpers';

type Named = { name: string };
type TaskDto = { id: string; title: string; assignee: { code: string }; project: Named };

async function freshSampleData() {
  await resetData();
  const res = await importTranscript();
  expect(res.status).toBe(201);
}

const projectId = async (name: string) => (await prisma.project.findFirstOrThrow({ where: { name } })).id;
const taskId = async (title: string) => (await prisma.task.findFirstOrThrow({ where: { title } })).id;

async function visibleProjects(user: DemoLogin): Promise<string[]> {
  const res = await api().get('/api/projects').set(await auth(user));
  expect(res.status).toBe(200);
  return res.body.projects.map((p: Named) => p.name).sort();
}

async function visibleTasks(user: DemoLogin): Promise<TaskDto[]> {
  const res = await api().get('/api/tasks').set(await auth(user));
  expect(res.status).toBe(200);
  return res.body.tasks;
}

describe('read access', () => {
  beforeAll(freshSampleData);

  describe('ADMIN', () => {
    it('sees all projects and all tasks', async () => {
      expect(await visibleProjects('admin')).toEqual(['HelpDeskPro AI Assistant', 'QuickServe Mobile App', 'UrbanCart Website']);
      expect(await visibleTasks('admin')).toHaveLength(12);
    });

    it('can open any project with all of its tasks', async () => {
      const res = await api().get(`/api/projects/${await projectId('QuickServe Mobile App')}`).set(await auth('admin'));
      expect(res.status).toBe(200);
      expect(res.body.project.tasks).toHaveLength(4);
    });
  });

  describe('MANAGER', () => {
    it.each([
      ['ayesha', 'UrbanCart Website'],
      ['bilal', 'QuickServe Mobile App'],
      ['hina', 'HelpDeskPro AI Assistant'],
    ] as const)('%s sees only the project they manage', async (user, project) => {
      expect(await visibleProjects(user)).toEqual([project]);
    });

    it('sees every task of their project, including all developers', async () => {
      const tasks = await visibleTasks('ayesha');
      expect(tasks).toHaveLength(4);
      expect(new Set(tasks.map((t) => t.project.name))).toEqual(new Set(['UrbanCart Website']));

      const res = await api().get('/api/projects').set(await auth('ayesha'));
      expect(res.body.projects[0]).toMatchObject({ taskCount: 4, totalEstimatedHours: 40 });
      expect(res.body.projects[0].members.map((m: { code: string }) => m.code)).toEqual(['DEV01', 'DEV02']);
    });

    it('gets 404 for other managers\' projects and tasks', async () => {
      const other = await projectId('QuickServe Mobile App');
      expect((await api().get(`/api/projects/${other}`).set(await auth('ayesha'))).status).toBe(404);
      expect((await api().get(`/api/projects/${other}/tasks`).set(await auth('ayesha'))).status).toBe(404);
      expect((await api().get(`/api/tasks/${await taskId('Login and profile screens')}`).set(await auth('ayesha'))).status).toBe(404);
    });

    it('cannot reach admin-only transcript endpoints', async () => {
      expect((await api().get('/api/transcripts').set(await auth('ayesha'))).status).toBe(403);
      const create = await api().post('/api/transcripts').set(await auth('ayesha')).send({ transcript: 'x'.repeat(50) });
      expect(create.status).toBe(403);
    });
  });

  describe('DEVELOPER', () => {
    it('Ali sees only his three tasks and their project', async () => {
      const tasks = await visibleTasks('ali');
      expect(tasks.map((t) => t.title)).toEqual(['Product catalog UI', 'Demo cart UI', 'Website integration and testing']);
      expect(tasks.every((t) => t.assignee.code === 'DEV01')).toBe(true);
      expect(await visibleProjects('ali')).toEqual(['UrbanCart Website']);
    });

    it('Hamza sees his two tasks across UrbanCart and QuickServe', async () => {
      const tasks = await visibleTasks('hamza');
      expect(tasks.map((t) => `${t.project.name} / ${t.title}`).sort()).toEqual([
        'QuickServe Mobile App / Booking and account APIs',
        'UrbanCart Website / Product and cart APIs',
      ]);
      expect(await visibleProjects('hamza')).toEqual(['QuickServe Mobile App', 'UrbanCart Website']);
    });

    it('sees the project name and manager, but never other developers\' tasks', async () => {
      const res = await api().get(`/api/projects/${await projectId('UrbanCart Website')}`).set(await auth('ali'));
      expect(res.status).toBe(200);
      const { project } = res.body;
      expect(project.manager.name).toBe('Ayesha Khan');
      expect(project.tasks.map((t: TaskDto) => t.assignee.code)).toEqual(['DEV01', 'DEV01', 'DEV01']);
      // Counts, hours and members are computed from the developer's own tasks only.
      expect(project).toMatchObject({ taskCount: 3, totalEstimatedHours: 26 });
      expect(project.members.map((m: { code: string }) => m.code)).toEqual(['DEV01']);

      const projectTasks = await api().get(`/api/projects/${project.id}/tasks`).set(await auth('ali'));
      expect(projectTasks.body.tasks).toHaveLength(3);
    });

    it('gets 404 for projects and tasks outside their assignments', async () => {
      expect((await api().get(`/api/projects/${await projectId('QuickServe Mobile App')}`).set(await auth('ali'))).status).toBe(404);
      expect((await api().get(`/api/tasks/${await taskId('Product and cart APIs')}`).set(await auth('ali'))).status).toBe(404);
      expect((await api().get(`/api/tasks/${await taskId('Login and profile screens')}`).set(await auth('ali'))).status).toBe(404);
    });

    it('cannot widen the task list with query filters', async () => {
      const qs = await projectId('QuickServe Mobile App');
      const hamza = (await prisma.user.findUniqueOrThrow({ where: { code: 'DEV02' } })).id;
      const byProject = await api().get(`/api/tasks?projectId=${qs}`).set(await auth('ali'));
      const byAssignee = await api().get(`/api/tasks?assigneeId=${hamza}`).set(await auth('ali'));
      expect(byProject.body.tasks).toEqual([]);
      expect(byAssignee.body.tasks).toEqual([]);
    });

    it('cannot reach admin-only transcript endpoints', async () => {
      expect((await api().get('/api/transcripts').set(await auth('ali'))).status).toBe(403);
    });
  });
});

describe('write access', () => {
  beforeEach(freshSampleData);

  describe('ADMIN', () => {
    it('can create, edit and delete projects', async () => {
      const ayesha = (await prisma.user.findUniqueOrThrow({ where: { code: 'PM01' } })).id;
      const created = await api()
        .post('/api/projects')
        .set(await auth('admin'))
        .send({ name: 'Internal tools', clientName: 'NovaWorks', managerId: ayesha, deadline: '2026-11-30' });
      expect(created.status).toBe(201);

      const bilal = (await prisma.user.findUniqueOrThrow({ where: { code: 'PM02' } })).id;
      const edited = await api().patch(`/api/projects/${created.body.project.id}`).set(await auth('admin')).send({ managerId: bilal });
      expect(edited.body.project.manager.code).toBe('PM02');

      const deleted = await api().delete(`/api/projects/${created.body.project.id}`).set(await auth('admin'));
      expect(deleted.status).toBe(204);
    });

    it('deleting a project removes its tasks', async () => {
      await api().delete(`/api/projects/${await projectId('UrbanCart Website')}`).set(await auth('admin'));
      expect(await prisma.task.count()).toBe(8);
    });
  });

  describe('MANAGER', () => {
    it('can edit their own project and its tasks, and add/delete tasks', async () => {
      const urbanCart = await projectId('UrbanCart Website');
      const edit = await api().patch(`/api/projects/${urbanCart}`).set(await auth('ayesha')).send({ description: 'Demo store only.' });
      expect(edit.status).toBe(200);

      const task = await api().patch(`/api/tasks/${await taskId('Demo cart UI')}`).set(await auth('ayesha')).send({ estimatedHours: 9 });
      expect(task.body.task.estimatedHours).toBe(9);

      const ali = (await prisma.user.findUniqueOrThrow({ where: { code: 'DEV01' } })).id;
      const added = await api()
        .post(`/api/projects/${urbanCart}/tasks`)
        .set(await auth('ayesha'))
        .send({ title: 'Accessibility pass', assigneeId: ali, deadline: '2026-10-18', estimatedHours: 3 });
      expect(added.status).toBe(201);
      expect((await api().delete(`/api/tasks/${added.body.task.id}`).set(await auth('ayesha'))).status).toBe(204);
    });

    it('cannot create projects, reassign managers or delete projects', async () => {
      const urbanCart = await projectId('UrbanCart Website');
      const bilal = (await prisma.user.findUniqueOrThrow({ where: { code: 'PM02' } })).id;

      const create = await api().post('/api/projects').set(await auth('ayesha')).send({ name: 'X', clientName: 'Y', managerId: bilal, deadline: '2026-11-01' });
      const reassign = await api().patch(`/api/projects/${urbanCart}`).set(await auth('ayesha')).send({ managerId: bilal });
      const remove = await api().delete(`/api/projects/${urbanCart}`).set(await auth('ayesha'));
      expect([create.status, reassign.status, remove.status]).toEqual([403, 403, 403]);
    });

    it('cannot touch another manager\'s project or tasks (404)', async () => {
      const quickServe = await projectId('QuickServe Mobile App');
      const sara = (await prisma.user.findUniqueOrThrow({ where: { code: 'DEV03' } })).id;

      const editProject = await api().patch(`/api/projects/${quickServe}`).set(await auth('ayesha')).send({ name: 'Hijacked' });
      const editTask = await api().patch(`/api/tasks/${await taskId('Login and profile screens')}`).set(await auth('ayesha')).send({ status: 'DONE' });
      const addTask = await api()
        .post(`/api/projects/${quickServe}/tasks`)
        .set(await auth('ayesha'))
        .send({ title: 'Sneaky', assigneeId: sara, deadline: '2026-10-20', estimatedHours: 1 });
      expect([editProject.status, editTask.status, addTask.status]).toEqual([404, 404, 404]);
    });
  });

  describe('DEVELOPER', () => {
    it('can update the status of their own task', async () => {
      const res = await api().patch(`/api/tasks/${await taskId('Demo cart UI')}`).set(await auth('ali')).send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('IN_PROGRESS');
    });

    it('cannot change any other task field', async () => {
      const id = await taskId('Demo cart UI');
      for (const body of [{ estimatedHours: 99 }, { title: 'Renamed' }, { status: 'DONE', deadline: '2026-10-16' }]) {
        const res = await api().patch(`/api/tasks/${id}`).set(await auth('ali')).send(body);
        expect(res.status).toBe(403);
      }
      const task = await prisma.task.findUniqueOrThrow({ where: { id } });
      expect(task).toMatchObject({ estimatedHours: 8, title: 'Demo cart UI', status: 'TODO' });
    });

    it('cannot update another developer\'s task (404)', async () => {
      const res = await api().patch(`/api/tasks/${await taskId('Product and cart APIs')}`).set(await auth('ali')).send({ status: 'DONE' });
      expect(res.status).toBe(404);
    });

    it('cannot create, edit or delete projects and tasks', async () => {
      const urbanCart = await projectId('UrbanCart Website');
      const ali = (await prisma.user.findUniqueOrThrow({ where: { code: 'DEV01' } })).id;

      const addTask = await api()
        .post(`/api/projects/${urbanCart}/tasks`)
        .set(await auth('ali'))
        .send({ title: 'Extra', assigneeId: ali, deadline: '2026-10-18', estimatedHours: 1 });
      const editProject = await api().patch(`/api/projects/${urbanCart}`).set(await auth('ali')).send({ name: 'Mine' });
      const deleteTask = await api().delete(`/api/tasks/${await taskId('Demo cart UI')}`).set(await auth('ali'));
      expect([addTask.status, editProject.status, deleteTask.status]).toEqual([403, 403, 403]);
    });
  });
});
