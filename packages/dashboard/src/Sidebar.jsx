import { LayoutDashboard, Monitor, Users, Radar, UserPlus, Fingerprint } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, admin: false },
  { key: 'sessions', label: 'My Sessions', icon: Monitor, admin: false },
  { key: 'users', label: 'Users & Roles', icon: Users, admin: true },
  { key: 'monitor', label: 'Session Monitor', icon: Radar, admin: true },
  { key: 'add-user', label: 'Add User', icon: UserPlus, admin: true },
];

export default function Sidebar({ active, onNavigate, isAdmin, username }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-5">
        <Fingerprint className="h-6 w-6 text-brand-600" strokeWidth={2} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            AD SSO POC
          </p>
          <h1 className="text-lg font-bold leading-tight text-slate-900">Identity Dashboard</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.filter((item) => !item.admin || isAdmin).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                active === item.key
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-400">Signed in as</p>
        <p className="truncate text-sm font-semibold text-slate-800">{username}</p>
      </div>
    </aside>
  );
}

export { NAV_ITEMS };
