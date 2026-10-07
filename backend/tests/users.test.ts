import { api, auth, userIdByCode } from './helpers';

describe('Team directory', () => {
  it.each(['admin', 'ayesha', 'ali'] as const)('is readable by %s', async (name) => {
    const res = await api().get('/api/users').set(await auth(name));
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(10);
  });

  it('lists admin, then managers, then developers, without password data', async () => {
    const res = await api().get('/api/users').set(await auth('ali'));
    expect(res.body.users.map((u: { code: string }) => u.code)).toEqual([
      'ADMIN', 'PM01', 'PM02', 'PM03', 'DEV01', 'DEV02', 'DEV03', 'DEV04', 'DEV05', 'DEV06',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect(res.body.users[4]).toEqual({
      id: expect.any(String),
      code: 'DEV01',
      name: 'Ali Raza',
      email: 'ali@novaworks.example',
      role: 'DEVELOPER',
      specialization: 'Full-Stack',
      skills: ['React', 'Frontend integration'],
    });
  });

  it('filters by role', async () => {
    const res = await api().get('/api/users?role=MANAGER').set(await auth('ali'));
    expect(res.body.users.map((u: { name: string }) => u.name)).toEqual(['Ayesha Khan', 'Bilal Ahmed', 'Hina Malik']);
  });

  it('rejects an unknown role filter', async () => {
    const res = await api().get('/api/users?role=BOSS').set(await auth('ali'));
    expect(res.status).toBe(400);
  });

  it('returns one user by id, and 404 for an unknown id', async () => {
    const found = await api().get(`/api/users/${await userIdByCode('DEV03')}`).set(await auth('ali'));
    expect(found.body.user.name).toBe('Sara Noor');

    const missing = await api().get('/api/users/does-not-exist').set(await auth('ali'));
    expect(missing.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await api().get('/api/users');
    expect(res.status).toBe(401);
  });
});
