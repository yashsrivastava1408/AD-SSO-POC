import { buildApp } from './app.js';

const PORT = process.env.PORT || 4000;
const { app } = buildApp({ issuer: process.env.ISSUER || `http://localhost:${PORT}` });

app.listen(PORT, () => {
  console.log(`idp-core listening on http://localhost:${PORT}`);
});
