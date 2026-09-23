'use client';

import { useEffect, useState } from 'react';

type Program = { id: string; title: string; gujaratiTitle?: string };
type Unit = { id: string; label: string; residentUserId?: string | null; residentName?: string | null; residentMobile?: string | null; residentEmail?: string | null };

const blank = () => ({ date: new Date().toISOString().slice(0, 10), eventId: '', propertyUnitId: '', amount: '', category: '', description: '', notes: '' });

export default function CashCollectionPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState(blank());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [programResponse, unitResponse] = await Promise.all([fetch('/api/admin/finance/programs'), fetch('/api/admin/income/cash-payment')]);
      const programData = await programResponse.json();
      const unitData = await unitResponse.json();
      if (!programResponse.ok) throw new Error(programData.error || 'Unable to load programs.');
      if (!unitResponse.ok) throw new Error(unitData.error || 'Unable to load resident units.');
      setPrograms(programData || []);
      setUnits((unitData.units || []).filter((unit: Unit) => unit.residentUserId));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load form data.'); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(''); setMessage('');
    const amountPaise = String(Math.round(Number(form.amount || 0) * 100));
    if (!Number(amountPaise) || !form.propertyUnitId) { setError('Program, resident/flat and valid amount are required.'); setSaving(false); return; }
    try {
      const response = await fetch('/api/admin/income/cash-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amountPaise }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Cash collection save failed.');
      setForm(blank());
      setMessage('Cash entry created. It is now waiting in Payment Verification for final verification and receipt generation.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Cash collection save failed.'); } finally { setSaving(false); }
  }

  return <main className="main">
    <div className="page-title"><div><p className="eyebrow">FINANCE • INCOME</p><h1>Cash Collection / રોકડ આવક</h1><p>Authorized Master Admin, Sub Admin or Accountant resident/flat ke naam par cash payment request create kar sakte hain.</p></div><a className="btn btn-secondary" href="/admin/income">Income Register</a></div>
    <div className="card" style={{ borderTop: '3px solid var(--gold)' }}>
      <div className="section-head"><div><p className="eyebrow">CASH → VERIFICATION QUEUE</p><h2>New Cash Payment</h2></div><span className="badge">CASH</span></div>
      <div className="card" style={{ background: 'var(--soft-surface)', marginBottom: 18 }}><strong>Verification rule</strong><p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>Save karne ke baad entry automatically Payment Verification section me PENDING rahegi. Physical cash confirm karne ke baad Verify karne par Income Ledger aur resident ke My Bills → My Payment Receipts me receipt generate hogi.</p></div>
      {loading ? <p>Loading programs and resident units…</p> : <form onSubmit={save} className="form-grid">
        <div className="field"><label>Date</label><input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
        <div className="field"><label>Program</label><select className="input" value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })}><option value="">General / No program</option>{programs.map(program => <option key={program.id} value={program.id}>{program.title}</option>)}</select></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label>Resident / Flat Number</label><select className="input" value={form.propertyUnitId} onChange={e => setForm({ ...form, propertyUnitId: e.target.value })} required><option value="">Select resident / flat</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.label} — {unit.residentName || unit.residentEmail || 'Resident'}</option>)}</select>{!units.length && <small style={{ color: 'var(--muted)' }}>Only units linked to a registered resident account are shown.</small>}</div>
        <div className="field"><label>Amount (₹)</label><input className="input" required inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 501" /></div>
        <div className="field"><label>Payment Method</label><input className="input" value="CASH" readOnly /></div>
        <div className="field"><label>Category</label><input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Navratri contribution" /></div>
        <div className="field"><label>Description</label><input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label>Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Cash received details / collector note" /></div>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Cash Request'}</button><button type="button" className="btn btn-secondary" onClick={() => setForm(blank())}>Reset</button></div>
      </form>}
      {message && <p style={{ color: '#216a35', marginTop: 16 }}>{message}</p>}
      {error && <p className="login-error" style={{ marginTop: 16 }}>{error}</p>}
    </div>
    <style>{`.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.field{display:flex;flex-direction:column;gap:7px}.field label{font-weight:800;font-size:13px;color:var(--ink)}@media(max-width:700px){.form-grid{grid-template-columns:1fr}.field[style*="grid-column"]{grid-column:auto!important}}`}</style>
  </main>;
}
