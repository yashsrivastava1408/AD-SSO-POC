export function renderLoginPage({ uid, error }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sign in — AD SSO POC</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 12px; width: 320px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    h1 { font-size: 1.15rem; margin: 0 0 1.25rem; color: #f8fafc; }
    label { display: block; font-size: 0.8rem; margin-bottom: 0.3rem; color: #94a3b8; }
    input { width: 100%; padding: 0.55rem 0.7rem; margin-bottom: 1rem; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #f8fafc; box-sizing: border-box; }
    button { width: 100%; padding: 0.6rem; background: #6366f1; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
    button:hover { background: #4f46e5; }
    .error { background: #7f1d1d; color: #fecaca; padding: 0.5rem 0.7rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1rem; }
    .hint { margin-top: 1rem; font-size: 0.75rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in with your directory account</h1>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="post" action="/interaction/${uid}/login">
      <label>Username</label>
      <input name="username" autocomplete="username" autofocus />
      <label>Password</label>
      <input name="password" type="password" autocomplete="current-password" />
      <button type="submit">Sign in</button>
    </form>
    <div class="hint">Test accounts: alice / Password123 (Admins), bob / Password123 (Employees)</div>
  </div>
</body>
</html>`;
}

// Auto-submits oidc-provider's RP-initiated-logout confirmation form so a
// "sign out everywhere" click doesn't dead-end on a manual "yes, sign out of
// this IdP too" click — the RP already confirmed intent by initiating logout.
export function renderLogoutPage(form) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Signing out — AD SSO POC</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 12px; width: 320px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    h1 { font-size: 1.05rem; margin: 0 0 1.25rem; color: #f8fafc; font-weight: 500; }
    button { width: 100%; padding: 0.6rem; background: #6366f1; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Signing you out of the directory session&hellip;</h1>
    ${form}
    <noscript><button type="submit" form="op.logoutForm" value="yes" name="logout">Continue</button></noscript>
  </div>
  <script>
    var f = document.forms['op.logoutForm'];
    var confirmField = document.createElement('input');
    confirmField.type = 'hidden';
    confirmField.name = 'logout';
    confirmField.value = 'yes';
    f.appendChild(confirmField);
    f.submit();
  </script>
</body>
</html>`;
}
