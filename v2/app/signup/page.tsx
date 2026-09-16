'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../globals.css';

export default function Signup() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', flatNumber: '', password: '', confirmPassword: '' });
  const [otp, setOtp] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [step, setStep] = useState<'signup' | 'verify'>('signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function update(field: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, mobile: form.mobile, flatNumber: form.flatNumber, password: form.password }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Signup failed (${response.status})`);
      setVerificationEmail(data.email || form.email.toLowerCase());
      setStep('verify');
      setMessage('A 6-digit verification code has been sent to your registered email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
    } finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!/^\d{6}$/.test(otp)) { setError('Please enter the 6-digit verification code.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: verificationEmail, otp }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Verification failed (${response.status})`);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    } finally { setBusy(false); }
  }

  async function resend() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const response = await fetch('/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: verificationEmail }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Unable to resend (${response.status})`);
      setOtp('');
      setMessage('A new verification code has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification code.');
    } finally { setBusy(false); }
  }

  return <main className="login-page">
    <div className="login-shell">
      <section className="login-copy">
        <div className="login-brand"><div className="brand-mark">S</div><span>Society Administration</span></div>
        <p className="eyebrow" style={{ marginTop: 70 }}>Flat Owner Registration</p>
        <h1>Join your society <em>workspace.</em></h1>
        <p>Create your Flat Owner account using the flat and contact details already registered by the society administrator.</p>
      </section>

      <section className="login-card">
        <p className="eyebrow">Owner signup</p>
        {step === 'signup' ? <>
          <h2>Create your account</h2>
          <p>Registration is available for Flat Owners only. Your registered email will be verified before the account is activated.</p>
          <form onSubmit={submit}>
            <div className="field"><label htmlFor="name">Full name</label><input id="name" className="input" autoComplete="name" required value={form.name} onChange={e => update('name', e.target.value)} /></div>
            <div className="field"><label htmlFor="flatNumber">Flat number</label><input id="flatNumber" className="input" placeholder="e.g. A-101" required value={form.flatNumber} onChange={e => update('flatNumber', e.target.value)} /></div>
            <div className="form-grid"><div className="field"><label htmlFor="email">Registered email</label><input id="email" className="input" type="email" autoComplete="email" required value={form.email} onChange={e => update('email', e.target.value)} /></div><div className="field"><label htmlFor="mobile">Registered mobile</label><input id="mobile" className="input" type="tel" autoComplete="tel" required value={form.mobile} onChange={e => update('mobile', e.target.value)} /></div></div>
            <div className="form-grid"><div className="field"><label htmlFor="password">Password</label><input id="password" className="input" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={e => update('password', e.target.value)} /></div><div className="field"><label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" className="input" type="password" autoComplete="new-password" minLength={8} required value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} /></div></div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="premium-btn" disabled={busy}>{busy ? 'Sending verification code…' : 'Continue & verify email'}</button>
          </form>
        </> : <>
          <h2>Verify your email</h2>
          <p>Enter the 6-digit code sent to <strong>{verificationEmail}</strong>.</p>
          <form onSubmit={verify}>
            <div className="field"><label htmlFor="otp">Verification code</label><input id="otp" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
            {message && <div className="login-success" role="status">{message}</div>}
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="premium-btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify & activate account'}</button>
          </form>
          <button type="button" className="btn btn-secondary" onClick={resend} disabled={busy}>Resend code</button>
          <button type="button" className="text-btn" onClick={() => { setStep('signup'); setError(''); setMessage(''); }} style={{ marginTop: 10 }}>Back to signup details</button>
        </>}
        <small>Admin/Sub Admin accounts are never created through public signup. Already registered? <a href="/login" style={{ color: 'var(--maroon)', fontWeight: 700 }}>Sign in</a>.</small>
      </section>
    </div>
  </main>;
}
