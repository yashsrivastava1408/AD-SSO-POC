import { describe, it, expect } from 'vitest';
import request from 'supertest';
import cookieSignature from 'cookie-signature';
import { app, sessionStore } from '../server/index.js';

// Integration test against the real running idp-core (:4000): "sign out
// everywhere" must send the browser to the IdP's own end_session_endpoint
// (with id_token_hint + post_logout_redirect_uri) so the IdP-level SSO cookie
// actually dies too — previously it only destroyed this app's local session,
// leaving the IdP's own session alive so the very next /auth/login silently
// re-authenticated with no login form shown.
const SESSION_SECRET = process.env.SESSION_SECRET || 'dashboard-session-secret-dev-only';

function seedSession(username, groups, idToken) {
  const sid = `test-sid-${username}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    sessionStore.set(sid, { cookie: {}, user: { username, groups }, idToken }, (err) => {
      if (err) return reject(err);
      resolve(
        `dashboard.sid=${encodeURIComponent('s:' + cookieSignature.sign(sid, SESSION_SECRET))}`
      );
    });
  });
}

describe('GET /auth/logout ("sign out everywhere")', () => {
  it('redirects the browser to the IdP end_session_endpoint with the right params', async () => {
    const cookie = await seedSession('alice', ['Admins'], 'fake-id-token-for-hint');
    const res = await request(app).get('/auth/logout').set('Cookie', cookie);

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin + location.pathname).toBe('http://localhost:4000/session/end');
    expect(location.searchParams.get('client_id')).toBe('dashboard');
    expect(location.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:4002/');
    expect(location.searchParams.get('id_token_hint')).toBe('fake-id-token-for-hint');
  });

  it('still destroys the local dashboard session (not just a no-op)', async () => {
    const cookie = await seedSession('bob', ['Employees'], 'another-fake-token');
    await request(app).get('/auth/logout').set('Cookie', cookie);

    const meRes = await request(app).get('/api/me').set('Cookie', cookie);
    expect(meRes.body.user).toBeNull();
  });
});
