'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmailActionHandler() {
  const router = useRouter();
  const [message,setMessage]=useState('Processing your email action…');
  const [error,setError]=useState('');

  useEffect(() => {
    const params=new URLSearchParams(window.location.search);
    const mode=params.get('mode') || 'verifyEmail';
    const code=params.get('oobCode');
    if (!code) { setMessage(''); setError('This email action link is missing or invalid.'); return; }
    if (mode==='resetPassword') { router.replace('/reset-password?oobCode='+encodeURIComponent(code)); return; }
    if (mode!=='verifyEmail') { setMessage(''); setError('Unsupported email action.'); return; }
    fetch('/api/auth/verify-email?oobCode='+encodeURIComponent(code),{cache:'no-store'})
      .then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Email verification failed.');setMessage(d.message||'Gmail verified.');window.setTimeout(()=>router.replace('/login?verified=1'),900);})
      .catch(e=>{setMessage('');setError(e instanceof Error?e.message:'Email verification failed.');});
  },[router]);

  return <main className="login-page"><div className="login-blade" aria-hidden="true" /><section className="login-card auth-standalone auth-animate"><div className="auth-card-glow" aria-hidden="true" /><p className="eyebrow">Madhuli Yuva Group • Email Verification</p><h2>{error?'Action failed':'Please wait'}</h2>{message&&<div className="login-success" role="status">{message}</div>}{error&&<div className="login-error" role="alert">{error}</div>}{error&&<a className="premium-btn" href="/login" style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:18}}>Return to login</a>}</section></main>;
}
