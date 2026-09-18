'use client';
import { useEffect, useMemo, useState } from 'react';

type Flat = { id: string; flatNumber: string; ownerName: string | null; mobile: string | null; email: string | null; status: 'ACTIVE' | 'INACTIVE'; signupEnabled: boolean };
type FormState = { flatNumber: string; ownerName: string; mobile: string; email: string; status: 'ACTIVE' | 'INACTIVE'; signupEnabled: boolean };
const emptyForm: FormState = { flatNumber: '', ownerName: '', mobile: '', email: '', status: 'ACTIVE', signupEnabled: false };

export default function Flats() {
  const [rows, setRows] = useState<Flat[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Flat | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/flats', { cache: 'no-store' });
      if (r.ok) setRows(await r.json()); else setError('Organizer access required');
    } catch { setError('Could not load flats.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function startEdit(row: Flat) {
    setEditing(row);
    setForm({ flatNumber: row.flatNumber, ownerName: row.ownerName || '', mobile: row.mobile || '', email: row.email || '', status: row.status, signupEnabled: row.signupEnabled });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() { setEditing(null); setForm(emptyForm); setError(''); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = editing ? { id: editing.id, ownerName: form.ownerName, mobile: form.mobile, email: form.email, status: form.status, signupEnabled: form.signupEnabled } : form;
      const r = await fetch('/api/admin/flats', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body.error || 'Could not save flat.'); return; }
      cancelEdit(); await load();
    } finally { setSaving(false); }
  }

  async function toggle(row: Flat) {
    setError(''); const next = !row.signupEnabled;
    const r = await fetch('/api/admin/flats', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, ownerName: row.ownerName || '', mobile: row.mobile || '', email: row.email || '', status: row.status, signupEnabled: next }) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { setError(body.error || 'Could not update signup access.'); return; }
    setRows(rows.map((x) => x.id === row.id ? { ...x, signupEnabled: next } : x));
  }

  const filtered = useMemo(() => rows.filter((x) => [x.flatNumber, x.ownerName, x.mobile, x.email].some((v) => (v || '').toLowerCase().includes(query.toLowerCase()))), [rows, query]);

  return <div className="main">
    <div className="page-title"><div><p className="eyebrow">SOCIETY • MEMBERS</p><h1>Flats & Owners / ફ્લેટ અને સભ્યો</h1><p>Manage flat records, registered owner details and Owner account access.</p></div><div className="member-stats"><div className="stat-card card"><span className="stat-label">Registered</span><strong className="stat-value">{rows.length}</strong></div><div className="stat-card card"><span className="stat-label">Signup Ready</span><strong className="stat-value">{rows.filter(x => x.signupEnabled).length}</strong></div></div></div>
    <div className="card member-form" style={{ marginBottom: 18 }}>
      <div className="section-head"><div><h2>{editing ? 'Edit Flat / ફ્લેટ સુધારો' : 'Register Flat / ફ્લેટ નોંધણી'}</h2><p className="section-subtitle">Owner signup requires a registered email or mobile and explicit signup access.</p></div>{editing && <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel Edit</button>}</div>
      <form onSubmit={save} className="form-grid">
        <div className="field"><label htmlFor="flatNumber">Flat Number</label><input id="flatNumber" className="input" required disabled={!!editing} value={form.flatNumber} onChange={(e) => setForm({ ...form, flatNumber: e.target.value })} placeholder="A-101" /></div>
        <div className="field"><label htmlFor="ownerName">Owner Name</label><input id="ownerName" className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Full name" /></div>
        <div className="field"><label htmlFor="mobile">Registered Mobile</label><input id="mobile" className="input" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="98765 43210" /></div>
        <div className="field"><label htmlFor="email">Registered Email</label><input id="email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@example.com" /></div>
        <div className="field"><label htmlFor="status">Status</label><select id="status" className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></div>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span>Owner signup access</span><input type="checkbox" checked={form.signupEnabled} onChange={(e) => setForm({ ...form, signupEnabled: e.target.checked })} style={{ width: 20, height: 20 }} /><small>{form.signupEnabled ? 'Enabled' : 'Disabled'}</small></label>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Flat / Owner'}</button>
      </form>
      {error && <p className="login-error" role="alert">{error}</p>}
    </div>
    <div className="card"><div className="section-head directory-head"><div><p className="eyebrow">DIRECTORY</p><h2>Flat Directory</h2><p className="section-subtitle">{rows.length} registered flat{rows.length === 1 ? '' : 's'} • {rows.filter((x) => x.signupEnabled).length} signup-enabled</p></div><input className="input" style={{ maxWidth: 280 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search flat or owner…" aria-label="Search flats" /></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Flat</th><th>Owner</th><th>Mobile</th><th>Email</th><th>Status</th><th>Signup</th><th>Manage</th></tr></thead><tbody>
        {loading && <tr><td colSpan={7}>Loading flats…</td></tr>}
        {!loading && filtered.map((x) => <tr key={x.id}><td><b>{x.flatNumber}</b></td><td>{x.ownerName || '—'}</td><td>{x.mobile || '—'}</td><td>{x.email || '—'}</td><td><span className="badge">{x.status}</span></td><td><button type="button" className="btn" onClick={() => toggle(x)} aria-label={`${x.signupEnabled ? 'Disable' : 'Enable'} signup for ${x.flatNumber}`}>{x.signupEnabled ? 'Enabled' : 'Enable'}</button></td><td><button type="button" className="btn btn-secondary" onClick={() => startEdit(x)}>Edit</button></td></tr>)}
        {!loading && !filtered.length && <tr><td colSpan={7}>No flats found.</td></tr>}
      </tbody></table></div>
    </div>
  </div>;
}

const flatsStyle = `.member-stats{display:flex;gap:12px}.member-stats .stat-card{min-width:120px}.member-form{border-top:3px solid #b18a3a}.directory-head{align-items:flex-end}@media(max-width:700px){.page-title{align-items:flex-start}.member-stats{width:100%}.member-stats .stat-card{flex:1;min-width:0}.directory-head{align-items:stretch}.directory-head>.input{max-width:none!important;width:100%}.table-wrap{overflow-x:auto}.table{min-width:760px}.member-form .form-grid{grid-template-columns:1fr}}`;
if(typeof document!=="undefined"&&!document.getElementById("flats-page-style")){const s=document.createElement("style");s.id="flats-page-style";s.textContent=flatsStyle;document.head.appendChild(s)}
