import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/db.js';

// Closes the IDOR: DELETE /api/sessions/:id and POST /api/logout used to trust
// whatever id/username was passed with no check that the caller actually owned
// it. These exercise the fix against a real Postgres-backed session store.
describe('session ownership enforcement', () => {
  let pool;
  let app;
  let sessionStore;
  let accountGroupsCache;
  const createdIds = [];

  beforeAll(() => {
    pool = createPool();
    ({ app, sessionStore, accountGroupsCache } = buildApp({ pool, issuer: 'http://localhost:0' }));
    accountGroupsCache.set('alice', ['Admins']);
    accountGroupsCache.set('bob', ['Employees']);
  });

  afterAll(async () => {
    if (createdIds.length) {
      await pool.query('DELETE FROM sessions WHERE id = ANY($1)', [createdIds]);
    }
    await pool.end();
  });

  async function makeSession(username) {
    const row = await sessionStore.recordSession({
      jti: randomUUID(),
      username,
      clientId: 'dashboard',
      ip: '127.0.0.1',
    });
    createdIds.push(row.id);
    return row;
  }

  describe('DELETE /api/sessions/:id', () => {
    it('rejects with no x-actor header at all', async () => {
      const session = await makeSession('alice');
      const res = await request(app).delete(`/api/sessions/${session.id}`);
      expect(res.status).toBe(400);
    });

    it("rejects a non-owner, non-admin actor (bob trying to kill alice's session)", async () => {
      const session = await makeSession('alice');
      const res = await request(app).delete(`/api/sessions/${session.id}`).set('x-actor', 'bob');
      expect(res.status).toBe(403);
      const stillThere = await sessionStore.getSessionById(session.id);
      expect(stillThere.revoked_at).toBeNull();
    });

    it('allows the owner to delete their own session', async () => {
      const session = await makeSession('alice');
      const res = await request(app).delete(`/api/sessions/${session.id}`).set('x-actor', 'alice');
      expect(res.status).toBe(200);
      const after = await sessionStore.getSessionById(session.id);
      expect(after.revoked_at).not.toBeNull();
    });

    it("still allows an admin to delete someone else's session (override preserved)", async () => {
      const session = await makeSession('bob');
      const res = await request(app).delete(`/api/sessions/${session.id}`).set('x-actor', 'alice');
      expect(res.status).toBe(200);
      const after = await sessionStore.getSessionById(session.id);
      expect(after.revoked_at).not.toBeNull();
    });
  });

  describe('POST /api/logout', () => {
    it('rejects an actor logging out a username that is not their own', async () => {
      const res = await request(app)
        .post('/api/logout')
        .set('x-actor', 'bob')
        .send({ username: 'alice', clientId: 'dashboard' });
      expect(res.status).toBe(403);
    });

    it('allows an actor to log themselves out everywhere', async () => {
      const res = await request(app)
        .post('/api/logout')
        .set('x-actor', 'alice')
        .send({ username: 'alice', clientId: 'dashboard' });
      expect(res.status).toBe(200);
    });

    it('still allows an admin to trigger logout for someone else (override preserved)', async () => {
      const res = await request(app)
        .post('/api/logout')
        .set('x-actor', 'alice')
        .send({ username: 'bob', clientId: 'dashboard' });
      expect(res.status).toBe(200);
    });
  });

  describe('admin check survives a process restart (no login-time cache entry)', () => {
    it("resolves a real admin's access via a live LDAP lookup when the cache is empty", async () => {
      const freshPool = createPool();
      const fresh = buildApp({ pool: freshPool, issuer: 'http://localhost:0' });
      // Deliberately NOT seeding fresh.accountGroupsCache — simulates idp-core
      // having just restarted, so alice hasn't logged in against this instance yet.
      const res = await request(fresh.app).get('/api/admin/users').set('x-admin-actor', 'alice');
      expect(res.status).toBe(200);
      await freshPool.end();
    });
  });
});
