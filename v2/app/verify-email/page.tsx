'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmailActionHandler() {
  const router = useRouter();
  const [message,setMessage]=useState('Checking your verification…');
  const [error,setError]=useState('');

  useEffect(() => {
    let cancelled=false;
    const params=new URLSearchParams(window.location.search);
    const mode=params.get('mode') || 'verifyEmail';
    const code=params.get('oobCode');

    if (mode==='resetPassword' && code) {
      router.replace('/reset-password?oobCode='+encodeURIComponent(code));
      return;
    }
    if (mode!=='verifyEmail') {
      setMessage('');
      setError('Unsupported email action.');
      return;
    }
    if (!code) {
      setMessage('Open the verification link sent to your Gmail address.');
      return;
    }

    (async()=>{
      try {
        const response=await fetch('/api/auth/verify-email?oobCode='+encodeURIComponent(code),{cache:'no-store'});
        const data=await response.json().catch(()=>null);
        if(cancelled)return;
        if(!response.ok)throw new Error(data?.error||'Email verification failed.');
        setError('');
        setMessage(data?.message||'Gmail verified and your resident account is now active. Redirecting to sign in…');
        window.setTimeout(()=>router.replace('/login?verified=1'),1200);
      } catch (e) {
        if(cancelled)return;
        setMessage('');
        setError(e instanceof Error?e.message:'Email verification failed. Please request a new verification email.');
      }
    })();

    return ()=>{cancelled=true};
  },[router]);

  return <main className="login-page"><div className="login-blade" aria-hidden="true" /><section className="login-card auth-standalone auth-animate"><div className="auth-card-glow" aria-hidden="true" /><p className="eyebrow">Madhuli Yuva Group • Email Verification</p><h2>{error?'Verification failed':'Email verification'}</h2>{message&&<div className="login-success" role="status">{message}</div>}{error&&<div className="login-error" role="alert">{error}</div>}{error&&<a className="premium-btn" href="/login" style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:18}}>Return to login</a>}</section></main>;
}
