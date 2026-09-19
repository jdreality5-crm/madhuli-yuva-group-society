'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'MASTER_ADMIN' | 'ORGANIZER' | 'OWNER'>('MASTER_ADMIN');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isVerified = params.get('verified') === '1';
    setVerified(isVerified);
    if (isVerified) setRole('OWNER');
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, role }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw Error(data?.error || `Login failed (${response.status})`);
      router.push('/');
    } catch (err) { setError(err instanceof Error ? err.message : 'Login failed. Please try again.'); }
    finally { setBusy(false); }
  }

  return <main className="login-page">
    <div className="login-blade" aria-hidden="true" />
    <div className="login-shell auth-animate">
      <section className="login-copy auth-copy">
        <div className="login-brand"><div className="brand-mark">S</div><span>Society Administration</span></div>
        <p className="eyebrow" style={{ marginTop: 70 }}>Madhuli Yuva Group • Resident &amp; Admin Access</p>
        <h1>One secure workspace for <em>society operations.</em></h1>
        <p>Manage programs, members, notices and authorized financial operations with a clean, responsive administration experience.</p>
        <div className="auth-points"><span>Secure role-based access</span><span>Resident-friendly workspace</span></div>
      </section>

      <section className="login-card auth-card">
        <div className="auth-card-glow" aria-hidden="true" />
        <p className="eyebrow">Secure access</p>
        <h2>Welcome back</h2>
        <p>Choose your role and sign in to continue.</p>
        {verified && <div className="login-success" role="status">Gmail verified successfully. You can now sign in.</div>}
        <div className="role-switch">
          {(['MASTER_ADMIN', 'ORGANIZER', 'OWNER'] as const).map(item => <button key={item} type="button" className={role === item ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setRole(item)}>{item === 'MASTER_ADMIN' ? 'Master Admin' : item === 'ORGANIZER' ? 'Sub Admin' : 'Resident'}</button>)}
        </div>
        <form onSubmit={submit}>
          <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="premium-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
        </form><a href="/forgot-password" className="text-btn" style={{display:'inline-block',marginTop:14}}>Forgot password?</a>
        {role === 'OWNER' && <div className="auth-link-row"><span>New Resident?</span> <a href="/signup">Create an account</a></div>}
        <small>Protected sign-in with role-based access. Never share your password or secret keys.</small>
      </section>
    </div>
  </main>;
}
