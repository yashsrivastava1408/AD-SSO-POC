import express from 'express';
import Provider from 'oidc-provider';
import { randomUUID } from 'node:crypto';
import { CLIENT_LIST } from './clients.js';
import { authenticate, listAllUsers, createUser, getGroupsForUsername } from './ldap.js';
import { createPool, createSessionStore } from './db.js';
import { createLogoutOrchestrator } from './logoutOrchestrator.js';
import { renderLoginPage, renderLogoutPage } from './views.js';

export function buildApp({ pool, issuer } = {}) {
  const ISSUER = issuer || process.env.ISSUER || 'http://localhost:4000';
  const sessionStore = createSessionStore(pool || createPool());
  const orchestrator = createLogoutOrchestrator(sessionStore);

  // Groups are looked up from AD once at login and cached for the life of the
  // interaction/session; a claims() re-query on every userinfo call would also
  // be reasonable, but this keeps the POC's LDAP traffic minimal.
  const accountGroupsCache = new Map();

  // Authorization checks (admin gate, session ownership) need an actor's groups
  // even when they haven't logged in since this process last started — fall
  // back to a live LDAP lookup on a cache miss instead of trusting the cache alone.
  async function resolveActorGroups(actor) {
    if (!actor) return [];
    if (accountGroupsCache.has(actor)) return accountGroupsCache.get(actor);
    try {
      const groups = await getGroupsForUsername(actor);
      accountGroupsCache.set(actor, groups);
      return groups;
    } catch {
      return [];
    }
  }

  async function findAccount(ctx, id) {
    return {
      accountId: id,
      async claims() {
        return { sub: id, groups: accountGroupsCache.get(id) || [] };
      },
    };
  }

  const oidc = new Provider(ISSUER, {
    clients: CLIENT_LIST,
    findAccount,
    claims: { openid: ['sub'], groups: ['groups'] },
    scopes: ['openid', 'groups'],
    conformIdTokenClaims: false,
    pkce: { required: () => false },
    cookies: { keys: [process.env.COOKIE_SECRET || 'poc-cookie-secret-dev-only'] },
    features: {
      devInteractions: { enabled: false },
      // RP-initiated logout ends the IdP's own SSO session — without this, "sign
      // out everywhere" only killed each app's local session while the browser's
      // still-valid IdP cookie silently re-authenticated the next /auth/login.
      rpInitiatedLogout: {
        enabled: true,
        logoutSource: async (ctx, form) => {
          ctx.body = renderLogoutPage(form);
        },
      },
    },
    ttl: { AccessToken: 3600, IdToken: 3600, Grant: 3600, Interaction: 3600, Session: 3600 },
  });
  oidc.proxy = true;

  // One row per completed login, per client — this is what the dashboard's
  // "login history" reads from, and what the logout fan-out looks up.
  oidc.on('authorization.success', async (ctx) => {
    try {
      const { Account, Client } = ctx.oidc.entities;
      if (Account && Client) {
        await sessionStore.recordSession({
          jti: randomUUID(),
          username: Account.accountId,
          clientId: Client.clientId,
          ip: ctx.ip,
        });
      }
    } catch (err) {
      console.error('failed to record session', err);
    }
  });

  const app = express();
  app.set('trust proxy', true);

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.get('/interaction/:uid', async (req, res, next) => {
    try {
      const details = await oidc.interactionDetails(req, res);
      const { uid, prompt, params, session } = details;
      if (prompt.name === 'login') {
        return res.send(renderLoginPage({ uid, error: null }));
      }
      if (prompt.name === 'consent') {
        // Our two clients are pre-registered/first-party — skip an explicit consent
        // screen, but still build a real Grant (required by oidc-provider) so the
        // interaction actually resolves instead of looping back into consent.
        let { grantId } = details;
        let grant;
        if (grantId) {
          grant = await oidc.Grant.find(grantId);
        } else {
          grant = new oidc.Grant({ accountId: session.accountId, clientId: params.client_id });
        }
        if (prompt.details.missingOIDCScope) {
          grant.addOIDCScope(prompt.details.missingOIDCScope.join(' '));
        }
        if (prompt.details.missingOIDCClaims) {
          grant.addOIDCClaims(prompt.details.missingOIDCClaims);
        }
        grantId = await grant.save();
        const result = { consent: { grantId } };
        return await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
      }
      return res.status(400).end();
    } catch (err) {
      next(err);
    }
  });

  app.post('/interaction/:uid/login', express.urlencoded({ extended: true }), async (req, res) => {
    const { uid } = req.params;
    const { username, password } = req.body;
    try {
      const profile = await authenticate(username, password);
      accountGroupsCache.set(profile.uid, profile.groups);
      const result = { login: { accountId: profile.uid } };
      await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch {
      res.send(renderLoginPage({ uid, error: 'Invalid username or password.' }));
    }
  });

  // --- REST API consumed server-to-server by the relying-party backends ---

  app.get('/api/sessions', async (req, res, next) => {
    try {
      const { user } = req.query;
      if (!user) return res.status(400).json({ error: 'user query param required' });
      const sessions = await sessionStore.listActiveSessionsForUser(user);
      res.json({ sessions });
    } catch (err) {
      next(err);
    }
  });

  // Caller identity for these two routes comes from x-actor, set by the calling
  // relying party's own backend from ITS OWN authenticated session — never from
  // client-controlled body/params — so it can't be spoofed by the browser.
  app.delete('/api/sessions/:id', async (req, res, next) => {
    try {
      const actor = req.get('x-actor');
      if (!actor) return res.status(400).json({ error: 'x-actor header required' });
      const session = await sessionStore.getSessionById(Number(req.params.id));
      if (!session || session.revoked_at)
        return res.status(404).json({ error: 'not found or already revoked' });
      if (session.username !== actor) {
        const groups = await resolveActorGroups(actor);
        if (!groups.includes('Admins')) {
          return res.status(403).json({ error: 'you may only sign out your own sessions' });
        }
      }
      const result = await orchestrator.revokeSession(session.id);
      if (!result) return res.status(404).json({ error: 'not found or already revoked' });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/logout', express.json(), async (req, res, next) => {
    try {
      const { username, clientId } = req.body || {};
      if (!username || !clientId) {
        return res.status(400).json({ error: 'username and clientId are required' });
      }
      const actor = req.get('x-actor');
      if (actor !== username) {
        const groups = await resolveActorGroups(actor);
        if (!groups.includes('Admins')) {
          return res.status(403).json({ error: 'you may only log out your own sessions' });
        }
      }
      const result = await orchestrator.logoutEverywhereExcept(username, clientId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // --- Admin API — called server-to-server by a relying party's backend on
  // behalf of a caller it has already authenticated. The x-admin-actor value
  // is only trustworthy because it names the actor's own logged-in-via-AD
  // identity; this middleware independently re-checks that identity's real
  // AD group membership (from the login-time cache) rather than trusting a
  // client-asserted "is admin" flag.
  async function requireAdminActor(req, res, next) {
    const actor = req.get('x-admin-actor');
    const groups = await resolveActorGroups(actor);
    if (!groups.includes('Admins')) {
      return res.status(403).json({ error: 'admin privileges required' });
    }
    next();
  }

  app.get('/api/admin/users', requireAdminActor, async (req, res, next) => {
    try {
      res.json({ users: await listAllUsers() });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/users', express.json(), requireAdminActor, async (req, res, next) => {
    try {
      const { username, password, group } = req.body || {};
      const user = await createUser(username, password, group);
      res.status(201).json({ user });
    } catch (err) {
      if (err.name === 'AlreadyExistsError') {
        return res.status(409).json({ error: 'a user with that username already exists' });
      }
      if (err.message?.includes('required') || err.message?.includes('must be one of')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  });

  app.get('/api/admin/sessions', requireAdminActor, async (req, res, next) => {
    try {
      res.json({ sessions: await sessionStore.listAllActiveSessions() });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/admin/sessions/:id', requireAdminActor, async (req, res, next) => {
    try {
      const result = await orchestrator.revokeSession(Number(req.params.id));
      if (!result) return res.status(404).json({ error: 'not found or already revoked' });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.use(oidc.callback());

  return { app, oidc, sessionStore, orchestrator, accountGroupsCache };
}
