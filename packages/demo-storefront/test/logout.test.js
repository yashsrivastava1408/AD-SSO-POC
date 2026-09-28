import { describe, it, expect } from 'vitest';
import request from 'supertest';
import cookieSignature from 'cookie-signature';
import { app, sessionStore } from '../server/index.js';

// "Sign out" (this app only) must end just Northmart's own session, leaving the
// IdP-level SSO session (and any other app's session) alone — distinct from
// "Sign out everywhere" (GET /auth/logout), which is covered by the live
// end-to-end curl walkthrough and the dashboard's equivalent test.
const SESSION_SECRET = process.env.SESSION_SECRET || 'storefront-session-secret-dev-only';

function seedSession(username, groups) {
  const sid = `test-sid-${username}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    sessionStore.set(sid, { cookie: {}, user: { username, groups } }, (err) => {
      if (err) return reject(err);
      resolve(
        `storefront.sid=${encodeURIComponent('s:' + cookieSignature.sign(sid, SESSION_SECRET))}`
      );
    });
  });
}

describe('GET /auth/logout-local ("sign out" — this app only)', () => {
  it('destroys only the local session and redirects to "/", not to the IdP end_session_endpoint', async () => {
    const cookie = await seedSession('bob', ['Employees']);
    const res = await request(app).get('/auth/logout-local').set('Cookie', cookie);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');

    const meRes = await request(app).get('/api/me').set('Cookie', cookie);
    expect(meRes.body.user).toBeNull();
  });

  it('does not error when there is no matching session record on idp-core', async () => {
    const cookie = await seedSession('nobody-with-no-real-idp-session', ['Employees']);
    const res = await request(app).get('/auth/logout-local').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});
