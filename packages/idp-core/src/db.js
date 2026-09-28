import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createPool() {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgres://idp:idp_pw@localhost:55432/idp_sessions',
  });
}

// schema.sql is just `CREATE TABLE IF NOT EXISTS`, so this is safe to run on every
// startup — it's what lets a fresh database (e.g. a new Render Postgres instance)
// provision itself with no manual migration step.
export async function runMigrations(pool) {
  const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

export function createSessionStore(pool) {
  return {
    async recordSession({ jti, username, clientId, ip }) {
      const { rows } = await pool.query(
        `INSERT INTO sessions (jti, username, client_id, ip)
         VALUES ($1, $2, $3, $4)
         RETURNING id, jti, username, client_id, ip, issued_at, revoked_at`,
        [jti, username, clientId, ip]
      );
      return rows[0];
    },

    async listActiveSessionsForUser(username) {
      const { rows } = await pool.query(
        `SELECT id, jti, username, client_id, ip, issued_at, revoked_at
         FROM sessions
         WHERE username = $1 AND revoked_at IS NULL
         ORDER BY issued_at DESC`,
        [username]
      );
      return rows;
    },

    // Admin "Session Monitor" — every active session, across every user.
    async listAllActiveSessions() {
      const { rows } = await pool.query(
        `SELECT id, jti, username, client_id, ip, issued_at, revoked_at
         FROM sessions
         WHERE revoked_at IS NULL
         ORDER BY issued_at DESC`
      );
      return rows;
    },

    async getSessionById(id) {
      const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
      return rows[0] || null;
    },

    async markRevoked(id) {
      const { rows } = await pool.query(
        `UPDATE sessions SET revoked_at = now() WHERE id = $1 RETURNING *`,
        [id]
      );
      return rows[0] || null;
    },
  };
}
