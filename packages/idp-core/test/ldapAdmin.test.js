import { randomUUID } from 'node:crypto';
import { describe, it, expect, afterEach } from 'vitest';
import { listAllUsers, createUser, authenticate, deleteUser } from '../src/ldap.js';

// Integration tests against the real openldap container.
describe('LDAP admin operations (Users & Roles / Add User features)', () => {
  const createdUsernames = [];

  function newTestUsername() {
    const username = `test-${randomUUID().slice(0, 8)}`;
    createdUsernames.push(username);
    return username;
  }

  afterEach(async () => {
    while (createdUsernames.length) {
      await deleteUser(createdUsernames.pop()).catch(() => {});
    }
  });

  it('lists every seeded user with their real group membership', async () => {
    const users = await listAllUsers();
    expect(users.map((u) => u.uid)).toEqual(expect.arrayContaining(['alice', 'bob', 'carol']));
    expect(users.find((u) => u.uid === 'alice').groups).toEqual(['Admins']);
    expect(users.find((u) => u.uid === 'bob').groups).toEqual(['Employees']);
  });

  it('creates a new user in the directory and adds them to the chosen group', async () => {
    const username = newTestUsername();
    const created = await createUser(username, 'TestPass123', 'Employees');
    expect(created).toEqual({ uid: username, groups: ['Employees'] });

    const users = await listAllUsers();
    expect(users.find((u) => u.uid === username)?.groups).toEqual(['Employees']);
  });

  it('a freshly created user can authenticate for real via LDAP bind', async () => {
    const username = newTestUsername();
    await createUser(username, 'TestPass123', 'Admins');
    const profile = await authenticate(username, 'TestPass123');
    expect(profile.groups).toEqual(['Admins']);
  });

  it('rejects creating a user in a group that does not exist', async () => {
    const username = `test-${randomUUID().slice(0, 8)}`;
    await expect(createUser(username, 'x', 'NotAGroup')).rejects.toThrow('group must be one of');
  });

  it('rejects creating a user that already exists', async () => {
    await expect(createUser('alice', 'x', 'Employees')).rejects.toThrow();
  });
});
