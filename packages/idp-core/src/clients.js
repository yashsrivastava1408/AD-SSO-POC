// Shared client registry: the two relying-party apps this IdP trusts.
// Base URLs and secrets are env-driven so the same code works unchanged whether
// the apps run on localhost or on real hosted URLs (e.g. Render) — only the env
// vars differ per environment, nothing here needs to change.
const STOREFRONT_URL = process.env.STOREFRONT_PUBLIC_URL || 'http://localhost:4001';
const DASHBOARD_URL = process.env.DASHBOARD_PUBLIC_URL || 'http://localhost:4002';

export const CLIENTS = {
  'demo-storefront': {
    client_id: 'demo-storefront',
    client_secret: process.env.STOREFRONT_CLIENT_SECRET || 'storefront_secret_dev_only',
    redirect_uris: [`${STOREFRONT_URL}/auth/callback`],
    post_logout_redirect_uris: [`${STOREFRONT_URL}/`],
    backchannel_logout_uri: `${STOREFRONT_URL}/backchannel-logout`,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
  },
  dashboard: {
    client_id: 'dashboard',
    client_secret: process.env.DASHBOARD_CLIENT_SECRET || 'dashboard_secret_dev_only',
    redirect_uris: [`${DASHBOARD_URL}/auth/callback`],
    post_logout_redirect_uris: [`${DASHBOARD_URL}/`],
    backchannel_logout_uri: `${DASHBOARD_URL}/backchannel-logout`,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
  },
};

export const CLIENT_LIST = Object.values(CLIENTS);
