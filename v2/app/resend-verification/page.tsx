'use client';

import { useState } from 'react';

export default function ResendVerification() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);
      setMessage(response.ok ? data?.message || 'If eligible, a verification email has been sent.' : data?.error || 'Request failed.');
    } catch {
      setMessage('Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page"><div className="login-blade" aria-hidden="true" /><section className="login-card auth-standalone auth-animate"><div className="auth-card-glow" aria-hidden="true" /><p className="eyebrow">Madhuli Yuva Group • Email Verification</p><h2>Resend verification email</h2><p>Enter your Firebase account details. Your password is sent only to the authentication endpoint over HTTPS.</p><form onSubmit={submit}><div className="field"><label htmlFor="verification-email">Gmail address</label><input id="verification-email" className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div><div className="field"><label htmlFor="verification-password">Password</label><input id="verification-password" className="input" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>{message && <div className="login-success" role="status">{message}</div>}<button className="premium-btn" disabled={busy}>{busy ? 'Sending…' : 'Resend verification email'}</button></form><a href="/login" className="text-btn" style={{display:'inline-block',marginTop:18}}>Back to login</a></section></main>;
}
