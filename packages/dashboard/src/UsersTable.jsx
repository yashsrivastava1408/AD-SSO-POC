export default function UsersTable({ users }) {
  if (!users.length) {
    return <p className="text-sm text-slate-500">No users found in the directory.</p>;
  }

  return (
    <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm">
      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-6 py-4">Username</th>
          <th className="px-6 py-4">Full name</th>
          <th className="px-6 py-4">Groups</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {users.map((u) => (
          <tr key={u.uid} className="transition-colors hover:bg-slate-50">
            <td className="px-6 py-5 text-[15px] font-medium text-slate-900">{u.uid}</td>
            <td className="px-6 py-5 text-[15px] text-slate-600">{u.cn}</td>
            <td className="px-6 py-5">
              <div className="flex flex-wrap gap-2">
                {u.groups.map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
