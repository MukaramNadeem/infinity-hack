import jwt from 'jsonwebtoken';
import { api, auth, userIdByCode } from './helpers';
import { TEST_ENV } from './testEnv';

describe('POST /api/auth/login', () => {
  it.each([
    ['admin', 'ADMIN', 'ADMIN'],
    ['ayesha', 'PM01', 'MANAGER'],
    ['ali', 'DEV01', 'DEVELOPER'],
  ])('logs in %s with the demo password', async (name, code, role) => {
    const res = await api().post('/api/auth/login').send({ email: `${name}@novaworks.example`, password: 'Demo123!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ code, role, email: `${name}@novaworks.example` });
    expect(Array.isArray(res.body.user.skills)).toBe(true);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('accepts the email case-insensitively and with surrounding spaces', async () => {
    const res = await api().post('/api/auth/login').send({ email: '  ALI@NovaWorks.example ', password: 'Demo123!' });
    expect(res.status).toBe(200);
    expect(res.body.user.code).toBe('DEV01');
  });

  it('rejects a wrong password and an unknown email with the same generic error', async () => {
    const wrongPassword = await api().post('/api/auth/login').send({ email: 'ali@novaworks.example', password: 'nope' });
    const unknownEmail = await api().post('/api/auth/login').send({ email: 'kamran@novaworks.example', password: 'Demo123!' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
  });

  it('returns 400 with field details for an invalid body', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'password']);
  });

  it('returns 400 INVALID_JSON for a malformed JSON body', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const res = await api().get('/api/auth/me').set(await auth('hina'));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ code: 'PM03', name: 'Hina Malik', role: 'MANAGER' });
  });

  it('returns 401 without a token', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a garbage token', async () => {
    const res = await api().get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects a token signed with another secret, even if it claims ADMIN', async () => {
    const forged = jwt.sign({ sub: await userIdByCode('DEV01'), role: 'ADMIN' }, 'some-other-secret-value');
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { sub: await userIdByCode('DEV01'), role: 'DEVELOPER', exp: Math.floor(Date.now() / 1000) - 60 },
      TEST_ENV.JWT_SECRET,
    );
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('takes the role from the database, not from the token payload', async () => {
    // Validly signed token for a developer that claims ADMIN in its payload.
    const token = jwt.sign({ sub: await userIdByCode('DEV01'), role: 'ADMIN' }, TEST_ENV.JWT_SECRET);
    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.user.role).toBe('DEVELOPER');

    const adminOnly = await api().get('/api/transcripts').set('Authorization', `Bearer ${token}`);
    expect(adminOnly.status).toBe(403);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 204 for a logged-in user', async () => {
    const res = await api().post('/api/auth/logout').set(await auth('ali'));
    expect(res.status).toBe(204);
  });
});

describe('misc', () => {
  it('GET /api/health is public', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown routes return a JSON 404', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
