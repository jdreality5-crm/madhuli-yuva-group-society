'use client';
import { useEffect, useState } from 'react';

type Request = {
  id: string; name: string; email: string; mobile: string | null; createdAt: string;
  flat: { flatNumber: string; ownerName: string | null; email: string | null; mobile: string | null } | null;
};

export default function OwnerApprovals() {
  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/owner-approvals', { cache: 'no-store' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body.error || 'Could not load approval requests.'); return; }
      setRows(body.users || []);
    } catch { setError('Could not load approval requests.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function decide(id: string, action: 'APPROVE' | 'REJECT') {
    if (!window.confirm(action === 'APPROVE' ? 'Approve this Owner account?' : 'Reject this Owner account?')) return;
    setBusy(id); setError('');
    try {
      const r = await fetch('/api/admin/owner-approvals', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body.error || 'Could not update approval.'); return; }
      setRows((current) => current.filter((x) => x.id !== id));
    } catch { setError('Could not update approval.'); }
    finally { setBusy(null); }
  }

  return <div className="main">
    <div className="page-title">
      <div><p className="eyebrow">SOCIETY • APPROVALS</p><h1>Owner Approvals / માલિક મંજૂરી</h1><p>Review Owner signup requests before email verification and account activation.</p></div>
      <div className="stat-card card"><span className="stat-label">Pending Requests</span><strong className="stat-value">{rows.length}</strong></div>
    </div>
    <div className="card">
      <div className="section-head"><div><h2>Pending Owner Requests</h2><p className="section-subtitle">Only Master Admin can approve or reject these requests.</p></div><button className="btn btn-secondary" onClick={load} disabled={loading}>Refresh</button></div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <div className="table-wrap"><table className="table"><thead><tr><th>Owner</th><th>Flat</th><th>Email</th><th>Mobile</th><th>Requested</th><th>Action</th></tr></thead><tbody>
        {loading && <tr><td colSpan={6}>Loading requests…</td></tr>}
        {!loading && rows.map((x) => <tr key={x.id}><td><b>{x.name}</b></td><td>{x.flat?.flatNumber || '—'}</td><td>{x.email}</td><td>{x.mobile || '—'}</td><td>{new Date(x.createdAt).toLocaleString()}</td><td><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-primary" disabled={busy === x.id} onClick={() => decide(x.id, 'APPROVE')}>{busy === x.id ? 'Saving…' : 'Approve'}</button><button className="btn btn-secondary" disabled={busy === x.id} onClick={() => decide(x.id, 'REJECT')}>Reject</button></div></td></tr>)}
        {!loading && !rows.length && <tr><td colSpan={6}>No pending Owner requests.</td></tr>}
      </tbody></table></div>
    </div>
  </div>;
}
