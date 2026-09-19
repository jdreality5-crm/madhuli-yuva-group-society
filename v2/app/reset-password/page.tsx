'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPassword() {
  const router = useRouter();
  const [code,setCode]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [done,setDone]=useState(false);
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    setCode(query.get('oobCode')||'');
  },[]);

  async function submit(e:React.FormEvent){e.preventDefault();setError('');if(!code){setError('This reset link is missing or invalid.');return;}if(password!==confirm){setError('Passwords do not match.');return;}setBusy(true);try{const r=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:code,newPassword:password})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Password reset failed.');setDone(true);window.setTimeout(()=>router.replace('/login'),1200);}catch(e){setError(e instanceof Error?e.message:'Password reset failed.')}finally{setBusy(false)}}

  return <main className="login-page"><div className="login-blade" aria-hidden="true" /><section className="login-card auth-standalone auth-animate"><div className="auth-card-glow" aria-hidden="true" /><p className="eyebrow">Madhuli Yuva Group • Account Security</p><h2>Reset your password</h2>{done?<div className="login-success" role="status">Password updated successfully. Redirecting to sign in…</div>:<form onSubmit={submit}><div className="field"><label>New password</label><input className="input" type="password" minLength={8} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="field"><label>Confirm password</label><input className="input" type="password" minLength={8} autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>{error&&<div className="login-error" role="alert">{error}</div>}<button className="premium-btn" disabled={busy}>{busy?'Updating…':'Update password'}</button></form>}</section></main>;
}
