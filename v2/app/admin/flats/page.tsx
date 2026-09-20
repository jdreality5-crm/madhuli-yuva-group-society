'use client';

import { useEffect, useMemo, useState } from 'react';

type Flat = { id: string; flatNumber: string; ownerName: string | null; mobile: string | null; email: string | null; status: 'ACTIVE' | 'INACTIVE'; signupEnabled: boolean; source?: 'PROPERTY_UNIT' | 'FLAT' };
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
      const response = await fetch('/api/admin/flats', { cache: 'no-store' });
      if (response.ok) setRows(await response.json());
      else setError('Administrator access required.');
    } catch { setError('Could not load resident records.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startEdit(row: Flat) {
    if (row.source === 'PROPERTY_UNIT') {
      setError('This registered resident is managed from the Properties section.');
      return;
    }
    setEditing(row);
    setForm({ flatNumber: row.flatNumber, ownerName: row.ownerName || '', mobile: row.mobile || '', email: row.email || '', status: row.status, signupEnabled: row.signupEnabled });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() { setEditing(null); setForm(emptyForm); setError(''); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = editing ? { id: editing.id, ownerName: form.ownerName, mobile: form.mobile, email: form.email, status: form.status, signupEnabled: form.signupEnabled } : form;
      const response = await fetch('/api/admin/flats', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || 'Could not save the record.'); return; }
      cancelEdit();
      await load();
    } finally { setSaving(false); }
  }

  async function toggle(row: Flat) {
    if (row.source === 'PROPERTY_UNIT') {
      setError('Signup access for registered resident units is managed from Properties.');
      return;
    }
    setError('');
    const next = !row.signupEnabled;
    const response = await fetch('/api/admin/flats', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, ownerName: row.ownerName || '', mobile: row.mobile || '', email: row.email || '', status: row.status, signupEnabled: next }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || 'Could not update signup access.'); return; }
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, signupEnabled: next } : item));
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => [row.flatNumber, row.ownerName, row.mobile, row.email].some((value) => (value || '').toLowerCase().includes(normalized)));
  }, [rows, query]);

  return <main className="main">
    <div className="page-title">
      <div><p className="eyebrow">SOCIETY • RESIDENTS</p><h1>Flats & Owners / ફ્લેટ અને સભ્યો</h1><p>Registered resident units are shown from the live property records. Manage unit details from Properties.</p></div>
      <div className="member-stats"><div className="stat-card card"><span className="stat-label">Registered residents</span><strong className="stat-value">{rows.length}</strong></div><div className="stat-card card"><span className="stat-label">Signup ready</span><strong className="stat-value">{rows.filter((row) => row.signupEnabled).length}</strong></div></div>
    </div>

    <div className="card directory-card">
      <div className="directory-toolbar"><div><p className="eyebrow">DIRECTORY</p><h2>Registered residents</h2><p className="section-subtitle">Search by unit, owner, mobile or email.</p></div><label className="directory-search"><span>Search residents</span><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search unit or owner…" aria-label="Search residents" /></label></div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <div className="table-wrap"><table className="table"><thead><tr><th>Unit</th><th>Owner</th><th>Mobile</th><th>Email</th><th>Status</th><th>Access</th><th>Manage</th></tr></thead><tbody>
        {loading && <tr><td colSpan={7}>Loading resident records…</td></tr>}
        {!loading && filtered.map((row) => <tr key={row.id}><td><b>{row.flatNumber}</b></td><td>{row.ownerName || '—'}</td><td>{row.mobile || '—'}</td><td>{row.email || '—'}</td><td><span className="badge">{row.status}</span></td><td>{row.source === 'PROPERTY_UNIT' ? 'Property unit' : row.signupEnabled ? 'Enabled' : 'Disabled'}</td><td>{row.source === 'PROPERTY_UNIT' ? <span className="directory-note">Properties</span> : <><button type="button" className="btn" onClick={() => toggle(row)}>{row.signupEnabled ? 'Disable' : 'Enable'}</button><button type="button" className="btn btn-secondary" onClick={() => startEdit(row)}>Edit</button></>}</td></tr>)}
        {!loading && !filtered.length && <tr><td colSpan={7}>No registered residents found.</td></tr>}
      </tbody></table></div>
    </div>

    <details className="card legacy-record-panel"><summary>Register standalone flat record</summary><p className="section-subtitle">Use this only for records that are not managed as a Property Unit.</p><form onSubmit={save} className="form-grid">
      <div className="field"><label htmlFor="flatNumber">Flat number</label><input id="flatNumber" className="input" required disabled={!!editing} value={form.flatNumber} onChange={(event) => setForm({ ...form, flatNumber: event.target.value })} placeholder="A-101" /></div>
      <div className="field"><label htmlFor="ownerName">Owner name</label><input id="ownerName" className="input" value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} /></div>
      <div className="field"><label htmlFor="mobile">Registered mobile</label><input id="mobile" className="input" inputMode="tel" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} /></div>
      <div className="field"><label htmlFor="email">Registered email</label><input id="email" className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
      <div className="field"><label htmlFor="status">Status</label><select id="status" className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FormState['status'] })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
      <label className="field signup-field"><span>Owner signup access</span><input type="checkbox" checked={form.signupEnabled} onChange={(event) => setForm({ ...form, signupEnabled: event.target.checked })} /><small>{form.signupEnabled ? 'Enabled' : 'Disabled'}</small></label>
      <div className="form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add standalone record'}</button>{editing && <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>}</div>
    </form></details>
  </main>;
}

const flatsStyle = `.member-stats{display:flex;gap:12px}.member-stats .stat-card{min-width:140px}.directory-card{border-top:3px solid #b18a3a}.directory-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:18px}.directory-search{display:flex;flex-direction:column;gap:7px;width:min(100%,340px);font-size:12px;font-weight:750;color:var(--muted)}.directory-note{font-size:12px;color:var(--muted);font-weight:700}.legacy-record-panel{margin-top:18px}.legacy-record-panel summary{cursor:pointer;font-weight:800;color:var(--ink);padding:2px}.signup-field{display:flex;align-items:center;gap:10px}.signup-field input{width:20px;height:20px}.form-actions{display:flex;gap:8px;align-items:center}@media(max-width:700px){.page-title{align-items:flex-start}.member-stats{width:100%}.member-stats .stat-card{flex:1;min-width:0}.directory-toolbar{align-items:stretch;flex-direction:column;gap:14px}.directory-search{width:100%}.table-wrap{overflow-x:auto}.table{min-width:780px}.legacy-record-panel .form-grid{grid-template-columns:1fr}.form-actions{flex-wrap:wrap}}`;
if (typeof document !== 'undefined' && !document.getElementById('flats-page-style')) { const style = document.createElement('style'); style.id = 'flats-page-style'; style.textContent = flatsStyle; document.head.appendChild(style); }
