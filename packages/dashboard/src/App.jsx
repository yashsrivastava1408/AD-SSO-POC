import { useCallback, useEffect, useState } from 'react';
import { Activity, Building2, Clock, ShieldCheck, LogOut } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import SessionsTable from './SessionsTable.jsx';
import UsersTable from './UsersTable.jsx';
import SessionMonitor from './SessionMonitor.jsx';
import AddUserForm from './AddUserForm.jsx';

const APP_LABELS = {
  'demo-storefront': 'Northmart',
  dashboard: 'Identity Dashboard',
};

function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" strokeWidth={2} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [active, setActive] = useState('overview');
  const [sessions, setSessions] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSessions, setAdminSessions] = useState([]);
  const [storefrontUrl, setStorefrontUrl] = useState(null);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => setStorefrontUrl(data.storefrontUrl))
      .catch(() => {});
  }, []);

  const loadSessions = useCallback(() => {
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => setSessions([]));
  }, []);

  const isAdmin = !!user?.groups?.includes('Admins');

  const loadAdminUsers = useCallback(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data) => setAdminUsers(data.users || []))
      .catch(() => setAdminUsers([]));
  }, []);

  const loadAdminSessions = useCallback(() => {
    fetch('/api/admin/sessions')
      .then((r) => r.json())
      .then((data) => setAdminSessions(data.sessions || []))
      .catch(() => setAdminSessions([]));
  }, []);

  useEffect(() => {
    if (user) loadSessions();
  }, [user, loadSessions]);

  useEffect(() => {
    if (!isAdmin) return;
    if (active === 'users') loadAdminUsers();
    if (active === 'monitor') loadAdminSessions();
  }, [active, isAdmin, loadAdminUsers, loadAdminSessions]);

  if (user === undefined) return null;

  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">You&rsquo;ve been signed out</h1>
          <p className="mt-1 text-sm text-slate-500">
            You&rsquo;re no longer signed in to the Identity Dashboard.
          </p>

          {storefrontUrl && (
            <div className="mt-6 rounded-lg border border-brand-100 bg-brand-50 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                First time here? This is a POC
              </p>
              <p className="mt-1.5 text-sm text-slate-600">
                Start at <span className="font-medium text-slate-900">Northmart</span>, our demo
                storefront, and sign in there first. Come back here afterwards — you&rsquo;ll
                already be signed in, no second login, because both apps share one AD-backed
                sign-on.
              </p>
              <a
                href={storefrontUrl}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
              >
                Go to Northmart →
              </a>
            </div>
          )}

          <a
            href="/auth/login"
            className="mt-6 inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Or sign in here directly
          </a>
        </div>
      </div>
    );
  }

  async function handleSignOut(id) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    loadSessions();
  }

  async function handleForceSignOut(id) {
    await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    loadAdminSessions();
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar active={active} onNavigate={setActive} isAdmin={isAdmin} username={user.username} />

      <div className="flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-8 py-4">
          <a
            href="/auth/logout-local"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </a>
          <a
            href="/auth/logout"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Sign out everywhere
          </a>
        </header>

        <main className="mx-auto max-w-4xl px-8 py-10">
          {active === 'overview' && (
            <>
              <PageHeader
                title="Overview"
                subtitle={`Signed in as ${user.username}, via Active Directory SSO.`}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  icon={Activity}
                  label="Active sessions"
                  value={sessions.length}
                  hint={
                    sessions.length === 1
                      ? 'across 1 connected app'
                      : `across ${sessions.length} connected apps`
                  }
                />
                <StatCard
                  icon={Building2}
                  label="Connected apps"
                  value={[...new Set(sessions.map((s) => s.client_id))].length}
                  hint={
                    [...new Set(sessions.map((s) => APP_LABELS[s.client_id] || s.client_id))].join(
                      ', '
                    ) || 'none yet'
                  }
                />
                <StatCard
                  icon={Clock}
                  label="Last sign-in"
                  value={
                    sessions.length
                      ? new Date(
                          Math.max(...sessions.map((s) => new Date(s.issued_at).getTime()))
                        ).toLocaleTimeString()
                      : '—'
                  }
                  hint={
                    sessions.length
                      ? new Date(
                          Math.max(...sessions.map((s) => new Date(s.issued_at).getTime()))
                        ).toLocaleDateString()
                      : 'no active sessions'
                  }
                />
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="h-4 w-4" strokeWidth={2} />
                  <span className="text-xs font-semibold uppercase tracking-wide">AD groups</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(user.groups || []).map((g) => (
                    <span
                      key={g}
                      className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                <LogOut className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p>
                  Need to sign out of one app, or everywhere at once? Head to{' '}
                  <button
                    onClick={() => setActive('sessions')}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    My Sessions
                  </button>{' '}
                  to manage where you&rsquo;re signed in.
                </p>
              </div>
            </>
          )}

          {active === 'sessions' && (
            <>
              <PageHeader
                title="My Sessions"
                subtitle="Where you're currently signed in, across every connected app."
              />
              <SessionsTable sessions={sessions} onSignOut={handleSignOut} />
            </>
          )}

          {active === 'users' && isAdmin && (
            <>
              <PageHeader
                title="Users & Roles"
                subtitle="Every account in the directory and its AD group membership."
              />
              <UsersTable users={adminUsers} />
            </>
          )}

          {active === 'monitor' && isAdmin && (
            <>
              <PageHeader
                title="Session Monitor"
                subtitle="Every active session across every user, right now."
              />
              <SessionMonitor sessions={adminSessions} onForceSignOut={handleForceSignOut} />
            </>
          )}

          {active === 'add-user' && isAdmin && (
            <>
              <PageHeader
                title="Add User"
                subtitle="Provision a new account directly into Active Directory."
              />
              <AddUserForm onCreated={loadAdminUsers} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
