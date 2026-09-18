'use client';

import { useState } from 'react';
import '../globals.css';

export default function ForgotPassword() {
  const [email,setEmail]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(e:React.FormEvent){e.preventDefault();setError('');setMessage('');setBusy(true);try{const r=await fetch('/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed.');setMessage(d.message);}catch(e){setError(e instanceof Error?e.message:'Request failed.')}finally{setBusy(false)}}

  return <main className="login-page"><section className="login-card" style={{maxWidth:520,margin:'10vh auto'}}><p className="eyebrow">Account recovery</p><h2>Forgot your password?</h2><p>Enter your Gmail address and Firebase will send a password reset email.</p><form onSubmit={submit}><div className="field"><label>Gmail address</label><input className="input" type="email" autoComplete="email" placeholder="name@gmail.com" required value={email} onChange={e=>setEmail(e.target.value)}/></div>{message&&<div className="login-success" role="status">{message}</div>}{error&&<div className="login-error" role="alert">{error}</div>}<button className="premium-btn" disabled={busy}>{busy?'Sending…':'Send reset email'}</button></form><a href="/login" className="text-btn" style={{display:'inline-block',marginTop:18}}>Back to login</a></section></main>;
}
