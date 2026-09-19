'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmailActionHandler() {
  const router = useRouter();
  const [message,setMessage]=useState('Checking your verification…');
  const [error,setError]=useState('');

  useEffect(() => {
    const params=new URLSearchParams(window.location.search);
    const mode=params.get('mode') || 'verifyEmail';
    const code=params.get('oobCode');
    if (mode==='resetPassword' && code) { router.replace('/reset-password?oobCode='+encodeURIComponent(code)); return; }
    if (mode!=='verifyEmail') { setMessage(''); setError('Unsupported email action.'); return; }
    // Firebase's hosted email-action handler consumes the verification code first.
    // The continueUrl then returns the browser here; the normal resident login
    // checks Firebase emailVerified and activates the local account.
    if (params.get('verified') === '1' || !code) {
      setMessage('Gmail verified. Redirecting you to secure sign in…');
      window.setTimeout(()=>router.replace('/login?verified=1'),500);
      return;
    }
    setMessage('Please use the verification link from your Gmail message.');
  },[router]);

  return <main className="login-page"><div className="login-blade" aria-hidden="true" /><section className="login-card auth-standalone auth-animate"><div className="auth-card-glow" aria-hidden="true" /><p className="eyebrow">Madhuli Yuva Group • Email Verification</p><h2>{error?'Action failed':'Email verification'}</h2>{message&&<div className="login-success" role="status">{message}</div>}{error&&<div className="login-error" role="alert">{error}</div>}{error&&<a className="premium-btn" href="/login" style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:18}}>Return to login</a>}</section></main>;
}
