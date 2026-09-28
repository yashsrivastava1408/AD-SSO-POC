import { describe, it, expect } from 'vitest';
import request from 'supertest';
import cookieSignature from 'cookie-signature';
import { app, sessionStore } from '../server/index.js';

// Integration test: exercises the dashboard's admin proxy routes against the
// real running idp-core (:4000) and real LDAP directory — not mocked — since
// the 409/400 error paths were previously only verified at the idp-core layer
// directly, not through the proxy a real admin actually hits from the browser.
const SESSION_SECRET = process.env.SESSION_SECRET || 'dashboard-session-secret-dev-only';

function seedSession(username, groups) {
  const sid = `test-sid-${username}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    sessionStore.set(sid, { cookie: {}, user: { username, groups } }, (err) => {
      if (err) return reject(err);
      resolve(
        `dashboard.sid=${encodeURIComponent('s:' + cookieSignature.sign(sid, SESSION_SECRET))}`
      );
    });
  });
}

describe('dashboard admin proxy (/api/admin/users)', () => {
  it('rejects with no session at all', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .send({ username: 'whoever', password: 'x', group: 'Employees' });
    expect(res.status).toBe(401);
  });

  it("proxies idp-core's 409 when the username already exists (alice)", async () => {
    const cookie = await seedSession('alice', ['Admins']);
    const res = await request(app)
      .post('/api/admin/users')
      .set('Cookie', cookie)
      .send({ username: 'alice', password: 'irrelevant', group: 'Employees' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("proxies idp-core's 400 when the group is not a real AD group", async () => {
    const cookie = await seedSession('alice', ['Admins']);
    const res = await request(app)
      .post('/api/admin/users')
      .set('Cookie', cookie)
      .send({ username: 'someone-new', password: 'irrelevant', group: 'NotARealGroup' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be one of/i);
  });
});
