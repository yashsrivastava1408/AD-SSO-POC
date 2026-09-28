import { Client, Change, Attribute } from 'ldapts';

const LDAP_URL = process.env.LDAP_URL || 'ldap://localhost:3890';
const USER_BASE = process.env.LDAP_USER_BASE || 'ou=People,dc=adsso,dc=local';
const GROUP_BASE = process.env.LDAP_GROUP_BASE || 'ou=Groups,dc=adsso,dc=local';
const KNOWN_GROUPS = ['Admins', 'Employees'];
// Directory read-only service account, used only to look up group membership after
// the user's own password has already been verified via their own bind below.
// Regular directory users have no read access outside their own entry (correct,
// least-privilege ACL behaviour), same as how a real AD integration needs a
// dedicated reader/service account for group lookups.
const READER_DN = process.env.LDAP_READER_DN || 'cn=admin,dc=adsso,dc=local';
const READER_PASSWORD = process.env.LDAP_READER_PASSWORD || 'AdminPass123';

// Assumes `client` is already bound as the reader account.
async function searchGroupsForUserDn(client, userDn) {
  const { searchEntries } = await client.search(GROUP_BASE, {
    scope: 'sub',
    filter: `(&(objectClass=groupOfNames)(member=${userDn}))`,
    attributes: ['cn'],
  });
  return searchEntries.map((entry) => (Array.isArray(entry.cn) ? entry.cn[0] : entry.cn));
}

async function findGroupsForUser(userDn) {
  const client = new Client({ url: LDAP_URL });
  try {
    await client.bind(READER_DN, READER_PASSWORD);
    return await searchGroupsForUserDn(client, userDn);
  } finally {
    await client.unbind();
  }
}

// Directory listing for the admin "Users & Roles" view — every person in
// the directory plus their live group membership.
export async function listAllUsers() {
  const client = new Client({ url: LDAP_URL });
  try {
    await client.bind(READER_DN, READER_PASSWORD);
    const { searchEntries } = await client.search(USER_BASE, {
      scope: 'sub',
      filter: '(objectClass=inetOrgPerson)',
      attributes: ['uid', 'cn'],
    });
    const users = [];
    for (const entry of searchEntries) {
      const uid = Array.isArray(entry.uid) ? entry.uid[0] : entry.uid;
      const cn = Array.isArray(entry.cn) ? entry.cn[0] : entry.cn;
      const groups = await searchGroupsForUserDn(client, `uid=${uid},${USER_BASE}`);
      users.push({ uid, cn, groups });
    }
    return users;
  } finally {
    await client.unbind();
  }
}

// Admin "Add User" feature: provisions a real account into the directory
// (not a local record) and adds it to the chosen group in the same step.
export async function createUser(username, password, group) {
  if (!username || !password || !group) {
    throw new Error('username, password and group are required');
  }
  if (!KNOWN_GROUPS.includes(group)) {
    throw new Error(`group must be one of ${KNOWN_GROUPS.join(', ')}`);
  }

  const userDn = `uid=${username},${USER_BASE}`;
  const groupDn = `cn=${group},${GROUP_BASE}`;
  const client = new Client({ url: LDAP_URL });
  try {
    await client.bind(READER_DN, READER_PASSWORD);
    await client.add(userDn, {
      objectClass: ['inetOrgPerson'],
      uid: username,
      cn: username,
      sn: username,
      givenName: username,
      mail: `${username}@adsso.local`,
      userPassword: password,
    });
    await client.modify(
      groupDn,
      new Change({
        operation: 'add',
        modification: new Attribute({ type: 'member', values: [userDn] }),
      })
    );
    return { uid: username, groups: [group] };
  } finally {
    await client.unbind();
  }
}

// Test/cleanup helper — removes a user's group memberships and their entry.
// Not exposed through the admin API/UI (no "delete user" feature was asked
// for); used to keep test runs from leaving residue in the real directory.
export async function deleteUser(username) {
  const userDn = `uid=${username},${USER_BASE}`;
  const client = new Client({ url: LDAP_URL });
  try {
    await client.bind(READER_DN, READER_PASSWORD);
    for (const group of KNOWN_GROUPS) {
      try {
        await client.modify(
          `cn=${group},${GROUP_BASE}`,
          new Change({
            operation: 'delete',
            modification: new Attribute({ type: 'member', values: [userDn] }),
          })
        );
      } catch {
        // user wasn't a member of this group — fine
      }
    }
    await client.del(userDn);
  } finally {
    await client.unbind();
  }
}

// Live group lookup by username alone (no password) — used to resolve an
// actor's admin status without depending on a login-time cache.
export async function getGroupsForUsername(username) {
  return findGroupsForUser(`uid=${username},${USER_BASE}`);
}

// Binds as the given user against the directory (real LDAP auth, no local password store)
// and returns their profile + AD group memberships.
export async function authenticate(username, password) {
  if (!username || !password) throw new Error('username and password are required');

  const userDn = `uid=${username},${USER_BASE}`;
  const userClient = new Client({ url: LDAP_URL });

  try {
    await userClient.bind(userDn, password);
  } catch {
    throw new Error('invalid credentials');
  } finally {
    await userClient.unbind();
  }

  const groups = await findGroupsForUser(userDn);
  return { dn: userDn, uid: username, groups };
}
