# Security notes

## Session ownership (fixed IDOR)

`DELETE /api/sessions/:id` and `POST /api/logout` on `idp-core` used to trust
whatever session ID or username was passed in, with no check that the caller
actually owned it. That meant any authenticated user could end **any other
user's session** just by knowing (or guessing) its numeric ID — a classic
Insecure Direct Object Reference.

Both endpoints now require an `x-actor` header — set server-side by the
calling relying party from **its own authenticated session**, never from
anything the browser can control directly — and check one of two things
before acting:

- the session/username being touched belongs to that actor, **or**
- the actor's real AD group membership includes `Admins`.

Anyone else gets a `403`. This is covered by
`packages/idp-core/test/sessionOwnership.test.js` (own-session delete
succeeds, cross-user delete without admin is rejected, admin cross-user
delete still succeeds) and was verified live against the real running
services: a non-admin (`bob`) attempting to delete another user's (`alice`'s)
session via a raw `curl` call got rejected with the exact `403` shown below,
while `alice`'s session remained untouched.

```json
{ "error": "you may only sign out your own sessions" }
```

## Admin authorization model

The admin-only endpoints (`GET/POST /api/admin/users`, `GET /api/admin/sessions`,
`DELETE /api/admin/sessions/:id`) are gated by `requireAdminActor` in
`packages/idp-core/src/app.js`. The caller's identity arrives via an
`x-admin-actor` header that the relying party's own backend sets from its own
session (see `requireAdmin` + `forwardToIdp` in
`packages/dashboard/server/index.js`) — it is never taken from the request
body or query string, so it can't be spoofed by the browser.

`idp-core` then independently re-checks that actor's **real** AD group
membership before allowing the request through — it does not trust a
client-asserted "I am an admin" flag. Group membership is normally read from
an in-memory cache populated at login time (`accountGroupsCache`), but on a
cache miss (e.g. right after `idp-core` restarts, before the actor has logged
in again) it falls back to a live LDAP lookup (`resolveActorGroups` →
`getGroupsForUsername`) rather than failing closed or trusting stale data.
This was verified by restarting `idp-core` and confirming an admin's access
still resolved correctly on the very first request afterward, with no prior
re-login.

A non-admin calling any of these endpoints directly — bypassing the UI
entirely, e.g. with their own valid session cookie via `curl` — is rejected
server-side with a `403`, not just hidden from the sidebar. This was verified
live, not just asserted by a unit test.

## What's still simplified (not hardened for production)

- Back-channel logout tokens are signed with a single shared HS256 secret
  across all three services, not per-service RS256 keys discovered via JWKS.
  Fine for a same-trust-boundary POC; a production deployment should move to
  `oidc-provider`'s own `features.backchannelLogout` with real key discovery.
- Dev secrets (session secrets, the logout-token secret, the OIDC client
  secrets) are hardcoded fallbacks in source, suffixed `_dev_only`. They must
  be replaced with real secrets from environment/secret-manager config before
  this runs anywhere beyond localhost.
- `oidc-provider`'s own signing keys and internal state (grants/tokens) are
  the library's ephemeral, in-memory development defaults — see the README's
  "Known simplifications" for what a production adapter/JWKS swap looks like.
