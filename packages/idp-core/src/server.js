import { buildApp } from './app.js';
import { createPool, runMigrations } from './db.js';

const PORT = process.env.PORT || 4000;
const pool = createPool();
await runMigrations(pool);
const { app } = buildApp({ pool, issuer: process.env.ISSUER || `http://localhost:${PORT}` });

app.listen(PORT, () => {
  console.log(`idp-core listening on http://localhost:${PORT}`);
});
