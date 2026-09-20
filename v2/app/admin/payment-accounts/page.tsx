'use client';

import { useEffect, useState } from 'react';

type Account = { id: string; displayName: string; upiId?: string | null; purpose: string; instructions?: string | null; qrImageUrl?: string | null };

export default function PaymentAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [instructions, setInstructions] = useState('');
  const [qr, setQr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/payment-accounts', { cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMsg(body?.error || `Unable to load payment accounts (${response.status})`);
        return;
      }
      setAccounts(Array.isArray(body?.accounts) ? body.accounts : []);
    } catch {
      setMsg('Network error while loading payment accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function uploadQr(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) return setMsg('QR image must be between 1 byte and 5 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setMsg('QR must be JPG, PNG or WEBP.');
    setUploading(true);
    setMsg('Uploading QR…');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'payment-qrs');
      const response = await fetch('/api/storage/upload', { method: 'POST', body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMsg(body?.error || `QR upload failed (${response.status})`);
        return;
      }
      setQr(body?.path || '');
      setMsg('QR uploaded securely.');
    } catch {
      setMsg('Network error during QR upload.');
    } finally {
      setUploading(false);
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg('');
    if (displayName.trim().length < 2 || purpose.trim().length < 2) {
      setMsg('Display name and purpose must contain at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/admin/payment-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim(), upiId: upiId.trim(), purpose: purpose.trim(), instructions: instructions.trim(), qrImageUrl: qr }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMsg(body?.error || `Could not create payment account (${response.status})`);
        return;
      }
      setMsg('Payment account created.');
      setDisplayName(''); setUpiId(''); setPurpose(''); setInstructions(''); setQr('');
      await load();
    } catch {
      setMsg('Network error while creating payment account.');
    } finally {
      setSaving(false);
    }
  }

  return <main className="main"><div className="page-title"><div><p className="eyebrow">FINANCE • UPI</p><h1>UPI Payment Accounts</h1><p>Master Admin controls the society payment receivers.</p></div><div className="stat-card card"><span className="stat-label">Active Receivers</span><strong className="stat-value">{accounts.length}</strong></div></div><form className="card finance-form grid" onSubmit={create}><div className="section-head"><div><p className="eyebrow">PAYMENT SETUP</p><h2>Add payment account</h2><p className="section-subtitle">Publish verified society UPI receivers for resident collections.</p></div></div><input className="input" required minLength={2} placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} /><input className="input" placeholder="UPI ID e.g. society@upi" value={upiId} onChange={e => setUpiId(e.target.value)} /><input className="input" required minLength={2} placeholder="Purpose / receiver" value={purpose} onChange={e => setPurpose(e.target.value)} /><textarea className="input" placeholder="Payment instructions" value={instructions} onChange={e => setInstructions(e.target.value)} /><label>UPI QR image<input className="input" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || saving} onChange={uploadQr} /></label>{qr && <p>✓ QR uploaded securely</p>}<button className="btn btn-primary" disabled={saving || uploading}>{saving ? 'Saving...' : 'Create Account'}</button></form>{msg && <div className="card">{msg}</div>}<section><div className="section-head"><div><p className="eyebrow">PUBLISHED RECEIVERS</p><h2>Payment Accounts</h2></div></div>{loading ? <div className="card">Loading payment accounts…</div> : <div className="grid">{accounts.map(a => <article className="card" key={a.id}><h3>{a.displayName}</h3><p><b>Purpose:</b> {a.purpose}</p><p><b>UPI:</b> {a.upiId || '—'}</p>{a.qrImageUrl && <img src={a.qrImageUrl} alt="UPI QR" style={{ width: 180, height: 180, objectFit: 'contain' }} />}</article>)}{!accounts.length && <div className="card">No payment accounts added yet.</div>}</div>}</section></main>;
}
