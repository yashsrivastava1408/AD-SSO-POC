import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import { Issuer, generators } from 'openid-client';
import { verifyLogoutToken } from '@ad-sso-poc/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4002;
const CLIENT_ID = 'dashboard';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'dashboard_secret_dev_only';
const IDP_ISSUER = process.env.IDP_ISSUER || 'http://localhost:4000';
const SELF_URL = process.env.SELF_URL || `http://localhost:${PORT}`;
// Northmart's public URL — surfaced to the frontend so a first-time visitor (e.g. a
// lead trying the hosted POC) is pointed at the right place to start the SSO demo.
const STOREFRONT_URL = process.env.STOREFRONT_URL || 'http://localhost:4001';

export const app = express();
export const sessionStore = new session.MemoryStore();
export const userSessions = new Map();

app.use(
  session({
    name: 'dashboard.sid',
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dashboard-session-secret-dev-only',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

let clientPromise;
function getClient() {
  if (!clientPromise) {
    clientPromise = Issuer.discover(IDP_ISSUER).then(
      (issuer) =>
        new issuer.Client({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uris: [`${SELF_URL}/auth/callback`],
          post_logout_redirect_uris: [`${SELF_URL}/`],
          response_types: ['code'],
        })
    );
  }
  return clientPromise;
}

function trackSession(username, sid) {
  if (!userSessions.has(username)) userSessions.set(username, new Set());
  userSessions.get(username).add(sid);
}

app.get('/auth/login', async (req, res, next) => {
  try {
    const client = await getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    req.session.oidcState = state;
    req.session.oidcNonce = nonce;
    res.redirect(client.authorizationUrl({ scope: 'openid groups', state, nonce }));
  } catch (err) {
    next(err);
  }
});

app.get('/auth/callback', async (req, res, next) => {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const { oidcState, oidcNonce } = req.session;
    const tokenSet = await client.callback(`${SELF_URL}/auth/callback`, params, {
      state: oidcState,
      nonce: oidcNonce,
    });
    const userinfo = await client.userinfo(tokenSet.access_token);
    req.session.user = { username: userinfo.sub, groups: userinfo.groups || [] };
    req.session.idToken = tokenSet.id_token;
    req.session.save(() => {
      trackSession(userinfo.sub, req.sessionID);
      res.redirect('/');
    });
  } catch (err) {
    next(err);
  }
});

// "Sign out" — ends only this portal's own session, leaving other connected
// apps (and the IdP-level SSO session) untouched. Kept separate from "Sign out
// everywhere" so leaving the dashboard doesn't unexpectedly log the user out
// of every app they're connected to.
app.get('/auth/logout-local', async (req, res) => {
  const username = req.session.user?.username;
  try {
    if (username) {
      const listRes = await fetch(
        `${IDP_ISSUER}/api/sessions?user=${encodeURIComponent(username)}`
      );
      const { sessions } = await listRes.json();
      const mine = (sessions || []).find((s) => s.client_id === CLIENT_ID);
      if (mine) {
        await fetch(`${IDP_ISSUER}/api/sessions/${mine.id}`, {
          method: 'DELETE',
          headers: { 'x-actor': username },
        });
      }
    }
  } catch (err) {
    console.error('local sign-out failed to revoke idp-core session record', err);
  }
  req.session.destroy(() => res.redirect('/'));
});

// "Sign out everywhere" — fans out to every other app via idp-core (requirement 3),
// then sends the browser to the IdP's own end_session_endpoint so its SSO cookie
// dies too; without that last step the very next /auth/login would silently
// re-authenticate via the still-valid IdP session, with no login form shown.
app.get('/auth/logout', async (req, res) => {
  const username = req.session.user?.username;
  const idToken = req.session.idToken;
  const sid = req.sessionID;
  const client = await getClient();
  req.session.destroy(async () => {
    if (username) {
      const sids = userSessions.get(username);
      if (sids) {
        sids.delete(sid);
        if (!sids.size) userSessions.delete(username);
      }
      try {
        await fetch(`${IDP_ISSUER}/api/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-actor': username },
          body: JSON.stringify({ username, clientId: CLIENT_ID }),
        });
      } catch (err) {
        console.error('logout fanout to idp-core failed', err);
      }
    }
    res.redirect(
      client.endSessionUrl({ id_token_hint: idToken, post_logout_redirect_uri: `${SELF_URL}/` })
    );
  });
});

app.post('/backchannel-logout', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const payload = await verifyLogoutToken(req.body.logout_token, CLIENT_ID);
    const sids = userSessions.get(payload.sub);
    if (sids) {
      for (const sid of sids) sessionStore.destroy(sid, () => {});
      userSessions.delete(payload.sub);
    }
    res.status(200).end();
  } catch {
    res.status(400).end();
  }
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get('/api/config', (req, res) => {
  res.json({ storefrontUrl: STOREFRONT_URL });
});

app.get('/api/sessions', async (req, res, next) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'not signed in' });
    const idpRes = await fetch(
      `${IDP_ISSUER}/api/sessions?user=${encodeURIComponent(req.session.user.username)}`
    );
    const data = await idpRes.json();
    res.status(idpRes.status).json(data);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/sessions/:id', async (req, res, next) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'not signed in' });
    const idpRes = await fetch(`${IDP_ISSUER}/api/sessions/${req.params.id}`, {
      method: 'DELETE',
      headers: { 'x-actor': req.session.user.username },
    });
    const data = await idpRes.json();
    res.status(idpRes.status).json(data);
  } catch (err) {
    next(err);
  }
});

// --- Admin routes (requirement 4/5: manage AD users/roles from the platform) ---
// Real server-side enforcement: this runs regardless of what the browser's UI
// shows, so a non-admin calling these directly with their own valid session
// cookie is rejected here, not just hidden from the sidebar.
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'not signed in' });
  if (!req.session.user.groups?.includes('Admins')) {
    return res.status(403).json({ error: 'admin privileges required' });
  }
  next();
}

async function forwardToIdp(req, res, path, options = {}) {
  const idpRes = await fetch(`${IDP_ISSUER}${path}`, {
    ...options,
    headers: { ...options.headers, 'x-admin-actor': req.session.user.username },
  });
  const data = await idpRes.json();
  res.status(idpRes.status).json(data);
}

app.get('/api/admin/users', requireAdmin, (req, res, next) => {
  forwardToIdp(req, res, '/api/admin/users').catch(next);
});

app.post('/api/admin/users', express.json(), requireAdmin, (req, res, next) => {
  forwardToIdp(req, res, '/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body),
  }).catch(next);
});

app.get('/api/admin/sessions', requireAdmin, (req, res, next) => {
  forwardToIdp(req, res, '/api/admin/sessions').catch(next);
});

app.delete('/api/admin/sessions/:id', requireAdmin, (req, res, next) => {
  forwardToIdp(req, res, `/api/admin/sessions/${req.params.id}`, { method: 'DELETE' }).catch(next);
});

app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`dashboard listening on ${SELF_URL}`));
}
