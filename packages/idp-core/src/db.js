import pg from 'pg';

const { Pool } = pg;

export function createPool() {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgres://idp:idp_pw@localhost:55432/idp_sessions',
  });
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
