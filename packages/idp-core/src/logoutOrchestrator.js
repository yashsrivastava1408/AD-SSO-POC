import { CLIENTS } from './clients.js';
import { signLogoutToken } from '@ad-sso-poc/shared';

async function sendBackchannelLogout(clientId, username) {
  const client = CLIENTS[clientId];
  if (!client?.backchannel_logout_uri) {
    return { clientId, ok: false, reason: 'no backchannel_logout_uri registered' };
  }
  const token = await signLogoutToken({ username, clientId });
  try {
    const res = await fetch(client.backchannel_logout_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ logout_token: token }),
    });
    return { clientId, ok: res.ok, status: res.status };
  } catch (e) {
    return { clientId, ok: false, reason: e.message };
  }
}

export function createLogoutOrchestrator(sessionStore) {
  return {
    // Dashboard "sign out of just this app" button: revoke one session, notify only its client.
    async revokeSession(id) {
      const session = await sessionStore.getSessionById(id);
      if (!session || session.revoked_at) return null;
      await sessionStore.markRevoked(id);
      const notified = [await sendBackchannelLogout(session.client_id, session.username)];
      return { session, notified };
    },

    // A relying party's own logout flow calls this: every OTHER app the user is
    // signed into gets a back-channel logout call (requirement 3).
    async logoutEverywhereExcept(username, initiatingClientId) {
      const sessions = await sessionStore.listActiveSessionsForUser(username);
      const notified = [];
      for (const session of sessions) {
        await sessionStore.markRevoked(session.id);
        if (session.client_id === initiatingClientId) continue;
        notified.push(await sendBackchannelLogout(session.client_id, username));
      }
      return { notified };
    },
  };
}

export { sendBackchannelLogout };
