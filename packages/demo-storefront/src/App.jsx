import { useEffect, useState } from 'react';
import { ShoppingCart, ShoppingBag, ShieldCheck, LogOutIcon } from 'lucide-react';
import { PRODUCTS } from './products.js';

function useMe() {
  const [me, setMe] = useState({ loading: true, user: null });
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => setMe({ loading: false, user: data.user }))
      .catch(() => setMe({ loading: false, user: null }));
  }, []);
  return me;
}

function Header({ user }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-brand-600" strokeWidth={2.25} />
          <span className="text-xl font-bold tracking-tight text-slate-900">Northmart</span>
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="/" className="hover:text-brand-600">
            Shop
          </a>
          {user && (
            <a href="/account" className="hover:text-brand-600">
              My Account
            </a>
          )}
          <ShoppingBag className="h-5 w-5 text-slate-400" />
          {user ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">
                Hi, {user.username}
              </span>
              <a
                href="/auth/logout-local"
                title="Sign out of Northmart only — your other apps stay signed in"
                className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                <LogOutIcon className="h-3.5 w-3.5" />
                Sign out
              </a>
            </div>
          ) : (
            <a
              href="/auth/login"
              className="rounded-md bg-brand-600 px-4 py-1.5 text-white hover:bg-brand-700"
            >
              Sign in
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

function ProductCard({ product }) {
  const Icon = product.icon;
  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-slate-50">
        <Icon
          className="h-10 w-10 text-slate-400 transition group-hover:text-brand-500"
          strokeWidth={1.5}
        />
      </div>
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-slate-900">{product.name}</h3>
        {product.tag && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
            {product.tag}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-lg font-bold text-slate-900">${product.price.toFixed(2)}</span>
        <button className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 group-hover:border-brand-500 group-hover:text-brand-600">
          Add to cart
        </button>
      </div>
    </div>
  );
}

function Shop() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Everything you need, delivered fast.
        </h1>
        <p className="mt-1 text-slate-500">
          A demo storefront used to prove the single sign-on flow end to end.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {PRODUCTS.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </main>
  );
}

export function AccountPage({ user }) {
  const isAdmin = user.groups?.includes('Admins');
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Account</h1>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="text-slate-500">Username</dt>
          <dd className="col-span-2 font-medium text-slate-900">{user.username}</dd>
          <dt className="text-slate-500">Signed in via</dt>
          <dd className="col-span-2 font-medium text-slate-900">Active Directory SSO</dd>
          <dt className="text-slate-500">AD groups</dt>
          <dd className="col-span-2 flex flex-wrap gap-2">
            {(user.groups || []).map((g) => (
              <span
                key={g}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
              >
                {g}
              </span>
            ))}
          </dd>
        </dl>
      </div>

      {isAdmin && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="flex items-center gap-2 font-semibold text-amber-900">
            <ShieldCheck className="h-5 w-5" />
            Admin Panel
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Only visible because your AD <code>Admins</code> group membership was carried through to
            this app&rsquo;s SSO token — this section is hidden for non-admin users.
          </p>
        </div>
      )}
    </main>
  );
}

export default function App() {
  const { loading, user } = useMe();
  const path = window.location.pathname;

  if (loading) return null;

  if (path === '/account' && !user) {
    window.location.href = '/auth/login';
    return null;
  }

  return (
    <div className="min-h-screen">
      <Header user={user} />
      {path === '/account' && user ? <AccountPage user={user} /> : <Shop />}
    </div>
  );
}
