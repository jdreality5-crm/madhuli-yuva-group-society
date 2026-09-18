'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import '../globals.css';

export default function VerifyEmailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState('Verifying your Gmail address…');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = params.get('oobCode');
    if (!code) { setError('This verification link is missing or invalid.'); setMessage(''); return; }
    fetch('/api/auth/verify-email?oobCode=' + encodeURIComponent(code), { method: 'GET', cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Email verification failed.');
        setMessage('Gmail verified successfully. Your account is now active.');
        window.setTimeout(() => router.replace('/'), 700);
      })
      .catch(error => { setMessage(''); setError(error instanceof Error ? error.message : 'Email verification failed.'); });
  }, [params, router]);

  return <main className="login-page"><section className="login-card" style={{maxWidth:520,margin:'10vh auto'}}><p className="eyebrow">Email verification</p><h2>{error ? 'Verification failed' : 'Email verified'}</h2>{message&&<div className="login-success" role="status">{message}</div>}{error&&<div className="login-error" role="alert">{error}</div>}{error&&<a className="premium-btn" href="/signup" style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:18}}>Return to signup</a>}</section></main>;
}
