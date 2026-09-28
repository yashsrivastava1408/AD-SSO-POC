import { describe, it, expect } from 'vitest';
import { authenticate } from '../src/ldap.js';

// Integration test: hits the real openldap container (docker compose up -d),
// not a mock, since proving the real bind works is the point of this POC.
describe('LDAP authentication against the real AD-style directory', () => {
  it('authenticates alice and returns her Admins group', async () => {
    const profile = await authenticate('alice', 'Password123');
    expect(profile.uid).toBe('alice');
    expect(profile.groups).toEqual(['Admins']);
  });

  it('authenticates bob and returns his Employees group', async () => {
    const profile = await authenticate('bob', 'Password123');
    expect(profile.groups).toEqual(['Employees']);
  });

  it('rejects an incorrect password', async () => {
    await expect(authenticate('alice', 'wrong-password')).rejects.toThrow('invalid credentials');
  });

  it('rejects a user that does not exist in the directory', async () => {
    await expect(authenticate('nobody', 'whatever')).rejects.toThrow();
  });
});
