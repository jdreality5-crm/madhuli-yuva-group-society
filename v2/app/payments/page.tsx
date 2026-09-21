'use client';

import { UiIcon } from '@/components/UiIcon';
import { useEffect, useMemo, useState } from 'react';

type A = { id: string; displayName: string; upiId?: string | null; qrImageUrl?: string | null; purpose: string; instructions?: string | null };
type P = { id: string; amountPaise: string; status: string; transactionId?: string | null; screenshotUrl?: string | null; rejectionReason?: string | null; expiresAt?: string | null; createdAt?: string | null; paymentAccount?: A | null };

const statusLabel = (status: string) => ({ VERIFIED: 'Verified / सफल', PENDING: 'Pending verification / जांच बाकी', REJECTED: 'Rejected / अस्वीकृत' }[status] || status);

export default function Payments() {
  const [billId, setBillId] = useState('');
  const [a, setA] = useState<A[]>([]);
  const [p, setP] = useState<P[]>([]);
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [current, setCurrent] = useState<P | null>(null);
  const [tx, setTx] = useState('');
  const [shot, setShot] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [showProof, setShowProof] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const qBill = query.get('billId');
    const qAmount = query.get('amount');
    if (qBill) setBillId(qBill);
    if (qAmount) setAmount(qAmount);
  }, []);

  async function load() {
    try {
      const [ar, pr] = await Promise.all([fetch('/api/admin/payment-accounts', { cache: 'no-store' }), fetch('/api/payments', { cache: 'no-store' })]);
      const [accounts, payments] = await Promise.all([ar.json().catch(() => ({})), pr.json().catch(() => ({}))]);
      if (!ar.ok) throw new Error(accounts.error || 'Unable to load payment accounts.');
      if (!pr.ok) throw new Error(payments.error || 'Unable to load payment history.');
      setA(accounts.accounts || []);
      setP(payments.payments || []);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Unable to load payments.');
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!current) return;
    const expiry = current.expiresAt ? new Date(current.expiresAt).getTime() : Date.now() + 600000;
    const tick = () => setSeconds(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [current]);

  const selectedAccount = useMemo(() => a.find(v => v.id === account) || null, [a, account]);
  const activeAccount = current?.paymentAccount || selectedAccount;
  const upiUrl = activeAccount?.upiId
    ? `upi://pay?${new URLSearchParams({ pa: activeAccount.upiId, pn: activeAccount.displayName, am: (Number(current?.amountPaise || 0) / 100).toFixed(2), cu: 'INR', tn: activeAccount.purpose }).toString()}`
    : '';

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setShowProof(false);
    const r = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentAccountId: account, amountPaise: String(Math.round(Number(amount) * 100)), billId: billId || undefined }),
    });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(x.error || 'Unable to start payment.');
    const payment = x.payment || {};
    setCurrent({
      ...payment,
      amountPaise: String(payment.amountPaise ?? Math.round(Number(amount) * 100)),
      expiresAt: payment.expiresAt || new Date(Date.now() + 600000).toISOString(),
      paymentAccount: a.find(v => v.id === account) || payment.paymentAccount || null,
    });
    setTx('');
    setShot('');
    setMsg('Payment session created. QR/UPI option is shown below. Upload proof only after completing the payment.');
  }

  function fileData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setMsg('Screenshot must be under 5 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setMsg('Please select a JPG, PNG or WEBP image.');
    const reader = new FileReader();
    reader.onload = () => {
      setShot(typeof reader.result === 'string' ? reader.result : '');
      setMsg('Screenshot ready. Now submit the payment proof.');
    };
    reader.onerror = () => setMsg('Could not read the screenshot. Please try again.');
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!current) return;
    if (!tx.trim()) return setMsg('Please enter the UPI transaction ID / UTR.');
    if (!shot) return setMsg('Please upload the payment screenshot.');
    if (seconds === 0) return setMsg('This payment session has expired. Start a new payment.');
    const r = await fetch('/api/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: current.id, transactionId: tx.trim(), screenshotUrl: shot }),
    });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(x.error || 'Could not submit payment proof.');
    setMsg('Payment proof submitted. Your status is now Pending verification.');
    setCurrent(null);
    setShowProof(false);
    setTx('');
    setShot('');
    await load();
  }

  return <main className="main">
    <div className="page-title"><div><p className="eyebrow">RESIDENT • PAYMENTS</p><h1>Society Payments / UPI</h1><p>Pay a published society/program collection and submit proof for verification.</p></div><div className="page-meta">Secure UPI</div></div>
    <form className="card finance-form grid" onSubmit={start}>
      <div className="section-head"><div><p className="eyebrow">NEW PAYMENT</p><h2>{billId ? 'Pay Bill' : 'Make a payment'}</h2><p className="section-subtitle">Choose the receiver and enter the amount. The payment QR will appear after session creation.</p></div></div>
      <div className="field"><label htmlFor="payment-account">Purpose / receiver</label><select id="payment-account" className="input" required value={account} onChange={e => setAccount(e.target.value)}><option value="">Select purpose / receiver</option>{a.map(v => <option key={v.id} value={v.id}>{v.purpose} — {v.displayName}</option>)}</select></div>
      <div className="field"><label htmlFor="payment-amount">Amount (₹)</label><input id="payment-amount" className="input" type="number" min="1" step="0.01" placeholder="Amount ₹" required value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <button className="btn btn-primary">Create Payment Session</button>
    </form>

    {current && <section className="card payment-processing">
      <div className="section-head"><div><p className="eyebrow">PAYMENT SESSION</p><h2>Complete payment</h2><p className="section-subtitle">Finish payment before the session expires, then submit proof.</p></div></div>
      <p><b>Amount:</b> ₹{(Number(current.amountPaise) / 100).toLocaleString('en-IN')}</p>
      <p><b>Session time remaining:</b> {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>
      {activeAccount?.qrImageUrl ? <img src={activeAccount.qrImageUrl} alt="UPI QR" style={{ width: 240, height: 240, objectFit: 'contain' }} /> : <div className="payment-method-note">QR code is not published for this receiver. Use the UPI ID below.</div>}
      {activeAccount?.upiId && <p><b>UPI ID:</b> {activeAccount.upiId}</p>}
      {activeAccount?.upiId && <button type="button" className="btn btn-primary" onClick={() => { window.location.href = upiUrl; }}>Open UPI App</button>}
      {activeAccount?.instructions && <p>{activeAccount.instructions}</p>}
      <p>Complete payment in Google Pay, PhonePe, Paytm or another UPI app, then return here.</p>
      {!showProof ? <button type="button" className="btn" onClick={() => setShowProof(true)} disabled={seconds === 0}>I completed payment — Upload proof</button> : <div className="grid">
        <div className="field"><label htmlFor="payment-utr">UPI Transaction ID / UTR</label><input id="payment-utr" className="input" placeholder="UPI Transaction ID / UTR" value={tx} onChange={e => setTx(e.target.value)} /></div>
        <div className="field"><label htmlFor="payment-screenshot">Payment screenshot</label><input id="payment-screenshot" className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={fileData} /></div>
        {shot && <p className="upload-success"><UiIcon name="check" size={16} /> Screenshot ready to submit</p>}
        <button type="button" className="btn btn-primary" disabled={!tx.trim() || !shot || seconds === 0} onClick={submit}>Submit Payment Proof</button>
      </div>}
    </section>}

    {msg && <div className="card">{msg}</div>}
    <section><div className="section-head"><div><p className="eyebrow">HISTORY</p><h2>My Payment History</h2></div></div><div className="grid">{p.map(v => <article className="card" key={v.id}><b>₹{(Number(v.amountPaise) / 100).toLocaleString('en-IN')}</b><p>{v.paymentAccount?.purpose || 'Society payment'}</p><p>Status: <b>{statusLabel(v.status)}</b></p>{v.transactionId && <p>Transaction ID: {v.transactionId}</p>}{v.status === 'REJECTED' && v.rejectionReason && <p className="login-error">Reason: {v.rejectionReason}</p>}{v.status === 'PENDING' && <small>Proof submitted / verification pending.</small>}{v.status === 'VERIFIED' && <small className="paid-note">Payment verified successfully.</small>}</article>)}</div></section>
    <style jsx>{`.payment-processing{border-top:3px solid var(--gold);box-shadow:0 14px 34px rgba(66,19,28,.07)}.payment-processing img{display:block;margin:16px 0;border:1px solid var(--border);border-radius:14px;padding:10px;background:#fff}.payment-method-note{padding:14px;border:1px dashed var(--gold);border-radius:14px;background:#fffaf2}@media(max-width:600px){.payment-processing img{width:100%;max-width:240px;height:auto}.payment-processing .input{width:100%}}`}</style>
  </main>;
}
