import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogoutOrchestrator } from '../src/logoutOrchestrator.js';

function fakeSessionStore(sessions) {
  return {
    async listActiveSessionsForUser(username) {
      return sessions.filter((s) => s.username === username && !s.revoked_at);
    },
    async getSessionById(id) {
      return sessions.find((s) => s.id === id) || null;
    },
    async markRevoked(id) {
      const s = sessions.find((x) => x.id === id);
      if (s) s.revoked_at = new Date().toISOString();
      return s;
    },
  };
}

describe('logout orchestrator', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it('fans out to every other active client but not the one that initiated logout', async () => {
    const sessions = [
      { id: 1, username: 'alice', client_id: 'demo-storefront', revoked_at: null },
      { id: 2, username: 'alice', client_id: 'dashboard', revoked_at: null },
    ];
    const orchestrator = createLogoutOrchestrator(fakeSessionStore(sessions));

    const { notified } = await orchestrator.logoutEverywhereExcept('alice', 'demo-storefront');

    expect(notified).toHaveLength(1);
    expect(notified[0].clientId).toBe('dashboard');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(sessions.every((s) => s.revoked_at)).toBe(true);
  });

  it("revokeSession notifies only that one session's client, leaving others untouched", async () => {
    const sessions = [
      { id: 1, username: 'alice', client_id: 'demo-storefront', revoked_at: null },
      { id: 2, username: 'alice', client_id: 'dashboard', revoked_at: null },
    ];
    const orchestrator = createLogoutOrchestrator(fakeSessionStore(sessions));

    const result = await orchestrator.revokeSession(1);

    expect(result.notified).toHaveLength(1);
    expect(result.notified[0].clientId).toBe('demo-storefront');
    expect(sessions[0].revoked_at).toBeTruthy();
    expect(sessions[1].revoked_at).toBeFalsy();
  });

  it('returns null when revoking a session that does not exist', async () => {
    const orchestrator = createLogoutOrchestrator(fakeSessionStore([]));
    expect(await orchestrator.revokeSession(999)).toBeNull();
  });

  it('returns null when revoking an already-revoked session', async () => {
    const sessions = [
      {
        id: 1,
        username: 'alice',
        client_id: 'demo-storefront',
        revoked_at: new Date().toISOString(),
      },
    ];
    const orchestrator = createLogoutOrchestrator(fakeSessionStore(sessions));
    expect(await orchestrator.revokeSession(1)).toBeNull();
  });
});
