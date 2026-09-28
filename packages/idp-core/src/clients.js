// Shared client registry: the two relying-party apps this IdP trusts.
// In a real deployment these would be registered per-environment, not hardcoded.
export const CLIENTS = {
  'demo-storefront': {
    client_id: 'demo-storefront',
    client_secret: 'storefront_secret_dev_only',
    redirect_uris: ['http://localhost:4001/auth/callback'],
    post_logout_redirect_uris: ['http://localhost:4001/'],
    backchannel_logout_uri: 'http://localhost:4001/backchannel-logout',
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
  },
  dashboard: {
    client_id: 'dashboard',
    client_secret: 'dashboard_secret_dev_only',
    redirect_uris: ['http://localhost:4002/auth/callback'],
    post_logout_redirect_uris: ['http://localhost:4002/'],
    backchannel_logout_uri: 'http://localhost:4002/backchannel-logout',
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
  },
};

export const CLIENT_LIST = Object.values(CLIENTS);
