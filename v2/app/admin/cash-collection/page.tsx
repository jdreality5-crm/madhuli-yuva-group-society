'use client';

import { useEffect, useState } from 'react';

type User = { id: string; name: string; email: string; mobile?: string | null; flatId?: string | null; unitId?: string | null };
type Account = { id: string; displayName: string; purpose: string; upiId?: string | null };
type Event = { id: string; title: string; gujaratiTitle?: string | null };

export default function CashCollection() {
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [eventId, setEventId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const response = await fetch('/api/admin/cash-payments');
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Unable to load options.');
    else {
      setUsers(data.users || []);
      setAccounts(data.accounts || []);
      setEvents(data.events || []);
      if (!paymentAccountId && data.accounts?.[0]) setPaymentAccountId(data.accounts[0].id);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setMessage(''); setSaving(true);
    const amountPaise = String(Math.round(Number(amount || 0) * 100));
    const response = await fetch('/api/admin/cash-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerUserId, paymentAccountId, eventId, amountPaise, notes }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Unable to create cash collection.');
    else {
      setMessage('Cash collection created. It is now waiting in Payment Verification for final verification.');
      setOwnerUserId(''); setEventId(''); setAmount(''); setNotes('');
    }
    setSaving(false);
  }

  return <main className="main">
    <div className="page-title"><div><p className="eyebrow">FINANCE • CASH COLLECTION</p><h1>Cash Collection</h1><p>Create a cash payment request for a resident. Final verification remains in Payment Verification.</p></div></div>
    {error && <div className="login-error">{error}</div>}
    {message && <div className="card" style={{ marginBottom: 18, color: '#216a35' }}>{message}</div>}
    <div className="card" style={{ borderTop: '3px solid var(--gold)' }}>
      {loading ? <p>Loading residents and programs…</p> : <form onSubmit={save} className="form-grid">
        <div className="field" style={{ gridColumn: '1/-1' }}><label>Resident / Flat</label><select className="input" required value={ownerUserId} onChange={e => setOwnerUserId(e.target.value)}><option value="">Select resident / flat</option>{users.map(user => <option key={user.id} value={user.id}>{user.name} {user.flatId ? `• Flat ${user.flatId}` : ''} • {user.mobile || user.email}</option>)}</select></div>
        <div className="field"><label>Program</label><select className="input" value={eventId} onChange={e => setEventId(e.target.value)}><option value="">General / No program</option>{events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}</select></div>
        <div className="field"><label>Cash Receiver</label><select className="input" required value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}><option value="">Select receiver</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.displayName} • {account.purpose}</option>)}</select></div>
        <div className="field"><label>Amount (₹)</label><input className="input" required inputMode="decimal" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label>Notes</label><textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Cash handover details / purpose" /></div>
        <div><button className="btn btn-primary" disabled={saving || !ownerUserId || !paymentAccountId}>{saving ? 'Saving…' : 'Create Cash Verification Request'}</button></div>
      </form>}
    </div>
  </main>;
}
