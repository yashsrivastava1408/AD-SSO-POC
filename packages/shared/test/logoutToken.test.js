import { describe, it, expect } from 'vitest';
import { signLogoutToken, verifyLogoutToken } from '../src/logoutToken.js';

describe('back-channel logout tokens', () => {
  it('signs a token that verifies for its intended audience', async () => {
    const token = await signLogoutToken({ username: 'alice', clientId: 'demo-storefront' });
    const payload = await verifyLogoutToken(token, 'demo-storefront');
    expect(payload.sub).toBe('alice');
    expect(payload.events['http://schemas.openid.net/event/backchannel-logout']).toBeDefined();
  });

  it('rejects verification against the wrong audience', async () => {
    const token = await signLogoutToken({ username: 'alice', clientId: 'demo-storefront' });
    await expect(verifyLogoutToken(token, 'dashboard')).rejects.toThrow();
  });

  it('rejects a tampered token', async () => {
    const token = await signLogoutToken({ username: 'alice', clientId: 'demo-storefront' });
    const tampered = token.slice(0, -2) + (token.at(-2) === 'A' ? 'B' : 'A') + token.at(-1);
    await expect(verifyLogoutToken(tampered, 'demo-storefront')).rejects.toThrow();
  });
});
