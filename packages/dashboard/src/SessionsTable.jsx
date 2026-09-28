const APP_LABELS = {
  'demo-storefront': 'Northmart (demo storefront)',
  dashboard: 'Identity Dashboard',
};

function formatTime(iso) {
  return new Date(iso).toLocaleString();
}

export default function SessionsTable({ sessions, onSignOut }) {
  if (!sessions.length) {
    return <p className="text-sm text-slate-500">No active sessions.</p>;
  }

  return (
    <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm">
      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-6 py-4">App</th>
          <th className="px-6 py-4">Signed in at</th>
          <th className="px-6 py-4">IP</th>
          <th className="px-6 py-4 text-right">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sessions.map((s) => (
          <tr key={s.id} className="transition-colors hover:bg-slate-50">
            <td className="px-6 py-5 text-[15px] font-medium text-slate-900">
              {APP_LABELS[s.client_id] || s.client_id}
            </td>
            <td className="px-6 py-5 text-[15px] text-slate-600">{formatTime(s.issued_at)}</td>
            <td className="px-6 py-5 text-[15px] text-slate-500">{s.ip || '—'}</td>
            <td className="px-6 py-5 text-right">
              <button
                onClick={() => onSignOut(s.id)}
                className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                Sign out
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
