import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';

// POC simplification: logout tokens are signed with a shared HS256 secret that the
// IdP and every relying party know, instead of RS256 + JWKS discovery. Format
// (iss/sub/aud/events) still follows the OIDC Back-Channel Logout 1.0 token shape.
//
// idp-core sets its own identity via ISSUER; the relying parties point at the IdP
// via IDP_ISSUER. Both name the same URL in this POC, so either satisfies the signer/
// verifier here.
const SECRET = new TextEncoder().encode(
  process.env.LOGOUT_TOKEN_SECRET || 'poc-shared-logout-secret-dev-only'
);
const ISSUER = process.env.ISSUER || process.env.IDP_ISSUER || 'http://localhost:4000';

export async function signLogoutToken({ username, clientId }) {
  return new SignJWT({
    events: { 'http://schemas.openid.net/event/backchannel-logout': {} },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(clientId)
    .setSubject(username)
    .setIssuedAt()
    .setJti(randomUUID())
    .sign(SECRET);
}

export async function verifyLogoutToken(token, expectedAudience) {
  const { payload } = await jwtVerify(token, SECRET, {
    issuer: ISSUER,
    audience: expectedAudience,
  });
  if (!payload.events || !payload.events['http://schemas.openid.net/event/backchannel-logout']) {
    throw new Error('not a logout token');
  }
  return payload;
}
