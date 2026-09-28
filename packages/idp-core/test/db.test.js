import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPool, createSessionStore } from '../src/db.js';

// Integration test against the real Postgres container.
describe('session store (Postgres)', () => {
  let pool;
  let store;
  const createdIds = [];

  beforeAll(() => {
    pool = createPool();
    store = createSessionStore(pool);
  });

  afterAll(async () => {
    if (createdIds.length) {
      await pool.query('DELETE FROM sessions WHERE id = ANY($1)', [createdIds]);
    }
    await pool.end();
  });

  it('records a session and lists it as active for that user', async () => {
    const username = `test-user-${randomUUID()}`;
    const row = await store.recordSession({
      jti: randomUUID(),
      username,
      clientId: 'demo-storefront',
      ip: '127.0.0.1',
    });
    createdIds.push(row.id);
    expect(row.username).toBe(username);

    const active = await store.listActiveSessionsForUser(username);
    expect(active).toHaveLength(1);
    expect(active[0].client_id).toBe('demo-storefront');
  });

  it('excludes a revoked session from the active listing', async () => {
    const username = `test-user-${randomUUID()}`;
    const row = await store.recordSession({
      jti: randomUUID(),
      username,
      clientId: 'dashboard',
      ip: '127.0.0.1',
    });
    createdIds.push(row.id);

    await store.markRevoked(row.id);

    const active = await store.listActiveSessionsForUser(username);
    expect(active).toHaveLength(0);

    const fetched = await store.getSessionById(row.id);
    expect(fetched.revoked_at).not.toBeNull();
  });

  it('returns null for a session id that does not exist', async () => {
    expect(await store.getSessionById(999999)).toBeNull();
  });
});
