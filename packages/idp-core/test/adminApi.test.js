import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/db.js';

// Integration test: real Postgres + real LDAP-backed listAllUsers(), and
// exercises the actual requireAdminActor middleware (requirement: admin
// endpoints must be enforced server-side, not just hidden in the UI).
describe('admin API authorization', () => {
  let pool;
  let app;
  let accountGroupsCache;

  beforeAll(() => {
    pool = createPool();
    ({ app, accountGroupsCache } = buildApp({ pool, issuer: 'http://localhost:0' }));
    // Simulate alice/bob having already logged in once via the real LDAP
    // flow, which is what actually populates this cache in production.
    accountGroupsCache.set('alice', ['Admins']);
    accountGroupsCache.set('bob', ['Employees']);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no admin-actor header at all', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(403);
  });

  it('rejects a real non-admin actor (bob, Employees) from listing users', async () => {
    const res = await request(app).get('/api/admin/users').set('x-admin-actor', 'bob');
    expect(res.status).toBe(403);
  });

  it('rejects a real non-admin actor from listing all sessions', async () => {
    const res = await request(app).get('/api/admin/sessions').set('x-admin-actor', 'bob');
    expect(res.status).toBe(403);
  });

  it('rejects a non-admin actor from creating a user', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('x-admin-actor', 'bob')
      .send({ username: 'sneaky', password: 'x', group: 'Admins' });
    expect(res.status).toBe(403);
  });

  it('rejects an actor nobody has ever logged in as (not in the cache)', async () => {
    const res = await request(app).get('/api/admin/users').set('x-admin-actor', 'ghost');
    expect(res.status).toBe(403);
  });

  it('allows a real admin actor (alice) to list the real directory', async () => {
    const res = await request(app).get('/api/admin/users').set('x-admin-actor', 'alice');
    expect(res.status).toBe(200);
    expect(res.body.users.map((u) => u.uid)).toEqual(
      expect.arrayContaining(['alice', 'bob', 'carol'])
    );
  });

  it('allows a real admin actor to list all active sessions', async () => {
    const res = await request(app).get('/api/admin/sessions').set('x-admin-actor', 'alice');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });
});
