'use client';

import { useEffect, useState } from 'react';

type P = {
  id: string; amountPaise: string; status: string; transactionId?: string | null;
  screenshotUrl?: string | null; createdAt: string;
  ownerUser: { name: string; email: string; mobile?: string | null; flatId?: string | null };
  paymentAccount: { displayName: string; upiId?: string | null; purpose: string };
  event?: { title: string; gujaratiTitle?: string | null } | null;
  verifiedBy?: { name: string; role: string } | null;
  bill?: { id:string; type:string; amountPaise:string; paymentStatus:string; category?:string|null; vendor?:string|null; date:string } | null;
};

export default function AdminPayments() {
  const [p, setP] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    const r = await fetch('/api/admin/payments');
    const x = await r.json();
    if (!r.ok) setError(x.error || 'Unable to load');
    else setP(x.payments || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function review(id: string, action: 'VERIFY' | 'REJECT') {
    const reason = action === 'REJECT'
      ? window.prompt('Reason for rejection?') || 'Payment evidence rejected.'
      : '';
    const r = await fetch('/api/admin/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: id, action, rejectionReason: reason }),
    });
    const x = await r.json();
    if (!r.ok) return setError(x.error || 'Review failed');
    load();
  }

  const pending = p.filter(v => v.status === 'PENDING' && !!v.transactionId);
  const money = (v: string) => `₹${(Number(v) / 100).toLocaleString('en-IN')}`;

  return <main className="main payment-verification-page">
    <div className="page-title">
      <div>
        <p className="eyebrow">FINANCE • VERIFICATION</p>
        <h1>Payment Verification</h1>
        <p>Review UPI evidence, confirm the transaction reference, and record verified payments.</p>
      </div>
      <div className="payment-header-actions">
        <div className="card pending-stat"><span className="stat-label">Pending Reviews</span><strong className="stat-value">{pending.length}</strong></div>
        <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
      </div>
    </div>

    {error && <div className="login-error">{error}</div>}

    {loading ? <div className="card payment-empty"><h3>Loading verification queue…</h3></div> :
      p.length === 0 ? <div className="card payment-empty"><div className="empty-icon">✓</div><h3>No payment submissions</h3><p>No resident payment proofs are waiting here.</p></div> :
      <div className="payment-queue">
        {p.map(v => <article className={`card payment-review-card ${v.status === 'PENDING' ? 'is-pending' : ''}`} key={v.id}>
          <div className="payment-card-head">
            <div><span className={`status-pill status-${v.status.toLowerCase()}`}>{v.status}</span><h2>{money(v.amountPaise)}</h2><p>{v.paymentAccount.purpose}</p></div>
            <div className="payment-meta"><span>{new Date(v.createdAt).toLocaleDateString('en-IN')}</span>{v.event?.title && <span>{v.event.title}</span>}</div>
          </div>
          <div className="payment-card-grid">
            <section className="payment-detail-block"><span className="detail-label">Resident</span><strong>{v.ownerUser.name}</strong><span>{v.ownerUser.flatId ? `Flat / Unit: ${v.ownerUser.flatId}` : 'Unit not listed'}</span><span>{v.ownerUser.mobile || v.ownerUser.email}</span></section>
            <section className="payment-detail-block"><span className="detail-label">Bill</span><strong>{v.bill ? `${v.bill.type} • ${money(v.bill.amountPaise)}` : 'General society payment'}</strong><span>{v.bill?.category || v.bill?.vendor || (v.bill ? 'Linked unit bill' : 'No bill linked')}</span><span>Status: {v.bill?.paymentStatus || '—'}</span></section><section className="payment-detail-block transaction-block"><span className="detail-label">Transaction Reference</span><strong>{v.transactionId || 'Not submitted yet'}</strong><span>Receiver: {v.paymentAccount.displayName}</span>{v.paymentAccount.upiId && <span>UPI: {v.paymentAccount.upiId}</span>}</section>
            <section className="payment-proof"><span className="detail-label">Payment Proof</span>{v.screenshotUrl ? <img src={v.screenshotUrl} alt="Payment proof screenshot" /> : <div className="proof-missing">No screenshot attached</div>}</section>
          </div>
          {v.status === 'PENDING' && v.transactionId && <div className="payment-actions"><button className="btn btn-primary" onClick={() => review(v.id, 'VERIFY')}>✓ Payment Received / Verify</button><button className="btn btn-secondary reject-btn" onClick={() => review(v.id, 'REJECT')}>Reject Payment</button></div>}
          {v.status !== 'PENDING' && v.verifiedBy && <div className="reviewed-note">Reviewed by {v.verifiedBy.name} · {v.verifiedBy.role}</div>}
        </article>)}
      </div>}

    <style>{`
      .payment-verification-page .page-title{align-items:flex-start}.payment-header-actions{display:flex;align-items:center;gap:12px}.pending-stat{min-width:150px;padding:12px 16px;border-top:3px solid var(--gold)}.pending-stat .stat-value{font-size:28px}.payment-queue{display:grid;gap:18px}.payment-review-card{overflow:hidden;border:1px solid var(--border);transition:transform .18s ease,box-shadow .18s ease}.payment-review-card.is-pending{border-top:3px solid var(--gold)}.payment-review-card:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(66,19,28,.08)}.payment-card-head{display:flex;justify-content:space-between;gap:20px;padding-bottom:16px;border-bottom:1px solid var(--border)}.payment-card-head h2{margin:8px 0 2px;color:var(--maroon);font-size:26px}.payment-card-head p{margin:0;color:var(--muted)}.payment-meta{display:flex;flex-direction:column;align-items:flex-end;gap:5px;color:var(--muted);font-size:13px}.status-pill{display:inline-flex;padding:5px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.04em}.status-pending{background:var(--gold-highlight);color:var(--maroon)}.status-verified{background:#e9f5ec;color:#216a35}.status-rejected{background:#fbe9e7;color:#9b2c25}.payment-card-grid{display:grid;grid-template-columns:repeat(3,1fr) 1.15fr;gap:18px;padding:20px 0}.payment-detail-block{display:flex;flex-direction:column;gap:6px}.detail-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800}.payment-detail-block strong{font-size:16px;color:var(--ink)}.transaction-block strong{font-family:var(--font-inter),sans-serif;font-size:18px;color:var(--maroon);word-break:break-all}.payment-proof{display:flex;flex-direction:column;gap:8px}.payment-proof img{width:100%;max-width:330px;max-height:320px;object-fit:contain;border:1px solid var(--border);border-radius:12px;background:var(--soft-surface);padding:6px}.proof-missing{padding:30px;border:1px dashed var(--border);border-radius:12px;color:var(--muted);text-align:center}.payment-actions{display:flex;gap:10px;padding-top:16px;border-top:1px solid var(--border);flex-wrap:wrap}.reject-btn{border-color:#c78b86;color:#8f3029}.reviewed-note{padding-top:14px;border-top:1px solid var(--border);color:var(--muted);font-size:13px}.payment-empty{text-align:center;padding:48px 24px}.empty-icon{width:44px;height:44px;border-radius:50%;margin:0 auto 12px;display:grid;place-items:center;background:var(--soft-surface);color:var(--maroon);font-weight:800}@media(max-width:800px){.payment-header-actions{width:100%;justify-content:space-between}.payment-card-grid{grid-template-columns:1fr}.payment-meta{align-items:flex-start}.payment-proof img{max-width:100%}}@media(max-width:560px){.payment-card-head{flex-direction:column}.payment-actions .btn{width:100%}.pending-stat{flex:1}.payment-header-actions .btn{white-space:nowrap}}
    `}</style>
  </main>;
}
