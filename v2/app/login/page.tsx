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
    <style>{`@media (max-width: 900px) {
      .login-page { align-items: flex-start; padding: 18px 14px 28px; overflow-y: auto; }
      .login-shell { gap: 18px; width: 100%; }
      .login-blade { height: 46%; top: -9%; right: -30%; opacity: .72; animation: mobileBladeIn .85s cubic-bezier(.2,.8,.2,1) both; }
      .login-copy { padding: 8px 4px 0; animation: mobileCopyIn .7s ease both; }
      .login-copy h1 { font-size: clamp(30px, 8vw, 38px); }
      .login-copy > p:last-child { line-height: 1.6; }
      .login-card { padding: 22px 18px; border-radius: 18px; animation: mobileCardIn .75s .08s cubic-bezier(.2,.8,.2,1) both; }
      .role-switch { gap: 6px; }
      .role-switch .btn { padding: 9px 5px; font-size: 11px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .login-blade, .auth-card, .auth-copy { animation: none !important; }
    }
    @keyframes mobileBladeIn { from { opacity: 0; transform: translate3d(24%, -5%, 0) skewX(-8deg); } to { opacity: .72; transform: translate3d(0, 0, 0) skewX(-8deg); } }
    @keyframes mobileCopyIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes mobileCardIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
    <div className="login-blade" aria-hidden="true" />
    <div className="login-shell auth-animate">
      <section className="login-copy auth-copy">
        <div className="login-brand"><div className="brand-mark">M</div><span>Madhuli Yuva Group Administration</span></div>
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
