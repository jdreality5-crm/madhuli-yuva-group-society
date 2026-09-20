'use client';

import { useEffect, useState } from 'react';

type BillForm = { type: 'RECEIPT' | 'INVOICE' | 'OTHER'; amount: string; vendor: string; category: string; date: string; paymentMethod: string; notes: string; propertyUnitId: string; fileUrl: string };
const initialForm = (): BillForm => ({ type: 'RECEIPT', amount: '', vendor: '', category: '', date: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', notes: '', propertyUnitId: '', fileUrl: '' });

export default function Bills() {
  const [rows, setRows] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [form, setForm] = useState<BillForm>(initialForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch('/api/admin/bills', { cache: 'no-store' });
    if (response.ok) setRows(await response.json());
    else setError('Administrator access required.');
  }

  useEffect(() => {
    load();
    fetch('/api/admin/properties', { cache: 'no-store' }).then((response) => response.json()).then((data) => setUnits((data.properties || []).flatMap((property: any) => (property.units || []).map((unit: any) => ({ ...unit, property }))))).catch(() => setError('Could not load property units.'));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const rupees = Number(form.amount);
    if (!Number.isFinite(rupees) || rupees <= 0 || !/^\d+(\.\d{1,2})?$/.test(form.amount.trim())) {
      setError('Enter a valid positive amount, for example 2500 or 2500.50.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amountPaise: String(Math.round(rupees * 100)), propertyUnitId: form.propertyUnitId || undefined };
      delete (payload as any).amount;
      const response = await fetch('/api/admin/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || 'Bill save failed.'); return; }
      setForm(initialForm());
      await load();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Delete this bill?')) return;
    const response = await fetch('/api/admin/bills/' + id, { method: 'DELETE' });
    if (!response.ok) { setError('Could not delete the bill.'); return; }
    await load();
  }

  return <main className="main">
    <div className="page-title"><div><p className="eyebrow">FINANCE • DOCUMENTS</p><h1>Bills & Documents</h1><p>Manage society financial documents with clear amount, date and payment details.</p></div><div className="stat-card card"><span className="stat-label">Documents</span><strong className="stat-value">{rows.length}</strong></div></div>
    <div className="card finance-form">
      <div className="section-head"><div><p className="eyebrow">RECORD • UPLOAD READY</p><h2>Add bill / receipt</h2><p className="section-subtitle">Enter the amount in rupees. The system converts it to paise only when saving.</p></div></div>
      <form onSubmit={save} className="form-grid">
        <div className="field"><label htmlFor="bill-property-unit">Property / Unit</label><select id="bill-property-unit" className="input" value={form.propertyUnitId} onChange={(event) => setForm({ ...form, propertyUnitId: event.target.value })}><option value="">Society-wide / No unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.property.block ? unit.property.block + ' • ' : ''}{unit.label} — {unit.property.name}</option>)}</select></div>
        <div className="field"><label htmlFor="bill-type">Type</label><select id="bill-type" className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as BillForm['type'] })}><option value="RECEIPT">Receipt</option><option value="INVOICE">Invoice</option><option value="OTHER">Other</option></select></div>
        <div className="field"><label htmlFor="bill-date">Date</label><input id="bill-date" className="input" type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></div>
        <div className="field"><label htmlFor="bill-amount">Amount (₹)</label><input id="bill-amount" className="input" inputMode="decimal" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1') })} placeholder="2500.00" /></div>
        <div className="field"><label htmlFor="bill-vendor">Vendor / Paid to</label><input id="bill-vendor" className="input" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} /></div>
        <div className="field"><label htmlFor="bill-category">Category</label><input id="bill-category" className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></div>
        <div className="field"><label htmlFor="bill-payment-method">Payment method</label><select id="bill-payment-method" className="input" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>{['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER'].map((method) => <option key={method}>{method}</option>)}</select></div>
        <div className="field"><label htmlFor="bill-document">Bill / Receipt document</label><input id="bill-document" className="input" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const data = new FormData(); data.append('file', file); data.append('folder', 'bills'); const response = await fetch('/api/storage/upload', { method: 'POST', body: data }); if (!response.ok) { setError('Document upload failed.'); return; } const uploaded = await response.json(); setForm((current) => ({ ...current, fileUrl: uploaded.path })); }} /><small>{form.fileUrl ? 'Document uploaded securely.' : 'Optional • JPG, PNG, WEBP or PDF • max 5 MB'}</small></div>
        <div className="field full-width"><label htmlFor="bill-notes">Notes</label><textarea id="bill-notes" className="input" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
        <div><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save document'}</button></div>
      </form>
      {error && <p className="login-error" role="alert">{error}</p>}
    </div>
    <div className="card"><div className="section-head"><div><p className="eyebrow">HISTORY</p><h2>Document Register</h2></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Unit</th><th>Type</th><th>Vendor</th><th>Category</th><th>Amount</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(row.date).toLocaleDateString('en-IN')}</td><td>{row.propertyUnit ? row.propertyUnit.label : 'Society-wide'}</td><td><span className="badge">{row.type}</span></td><td>{row.vendor || '—'}</td><td>{row.category || '—'}</td><td>₹{(Number(row.amountPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td><button className="btn btn-secondary" onClick={() => remove(row.id)}>Delete</button></td></tr>)}{!rows.length && <tr><td colSpan={7}>No bills recorded yet.</td></tr>}</tbody></table></div></div>
  </main>;
}

const billStyle = `.finance-form{border-top:3px solid #b18a3a}.finance-form h2,.card h2{margin-top:0}.full-width{grid-column:1/-1}.table-wrap{overflow-x:auto}@media(max-width:700px){.page-title{align-items:flex-start}.page-title>.stat-card{width:100%}.finance-form .form-grid{grid-template-columns:1fr}.full-width{grid-column:auto!important}.table{min-width:720px}}`;
if (typeof document !== 'undefined' && !document.getElementById('bill-page-style')) { const style = document.createElement('style'); style.id = 'bill-page-style'; style.textContent = billStyle; document.head.appendChild(style); }
