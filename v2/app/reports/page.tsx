'use client';

import { useEffect, useState } from 'react';

type EventItem = { id: string; title: string; gujaratiTitle?: string | null; date: string };

export default function Reports() {
  const [d, setD] = useState<any>();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    load();
  }, []);

  const params = () => {
    const value = new URLSearchParams({ from, to });
    if (eventId) value.set('eventId', eventId);
    return value;
  };

  async function load() {
    setError('');
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/reports?${params().toString()}`, { cache: 'no-store' });
      const x = await r.json().catch(() => null);
      if (!r.ok) {
        setError(x?.error || 'Unable to load report.');
        return;
      }
      setD(x);
      if (Array.isArray(x.events)) setEvents(x.events);
    } catch {
      setError('Unable to connect to the report service.');
    } finally {
      setLoading(false);
    }
  }

  const money = (v: string) => `₹ ${(Number(v) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const selectedEvent = events.find((event) => event.id === eventId);

  async function downloadPdf() {
    setError('');
    setPdfLoading(true);
    try {
      const response = await fetch(`/api/admin/reports/print?${params().toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error || 'Unable to generate PDF report.');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `society-financial-report-${from}-to-${to}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Unable to download PDF report.');
    } finally {
      setPdfLoading(false);
    }
  }

  return <div className="main">
    <div className="page-title">
      <div>
        <p className="eyebrow">FINANCE • REPORTS</p>
        <h1>આવક અને ખર્ચ રિપોર્ટ</h1>
        <p>વર્ષ, તારીખ અને કાર્યક્રમ પ્રમાણે અલગ નાણાકીય રિપોર્ટ બનાવો.</p>
      </div>
      <div className="report-actions">
        <button className="btn btn-primary" disabled={loading || pdfLoading} onClick={load}>{loading ? 'Loading…' : 'Generate Report'}</button>
        <button className="btn btn-secondary" disabled={!d || loading || pdfLoading} onClick={downloadPdf}>{pdfLoading ? 'Preparing PDF…' : 'Download PDF'}</button>
      </div>
    </div>

    <div className="report-filters card" style={{ borderTop: '3px solid var(--gold)' }}>
      <div className="field"><label>From</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="field"><label>To</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div className="field"><label>Program / Event</label><select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">All programs</option>{events.map((event) => <option key={event.id} value={event.id}>{event.gujaratiTitle || event.title}</option>)}</select></div>
      <p className="filter-help">Date aur program select karke <strong>Generate Report</strong> press karein. PDF ke liye <strong>Download PDF</strong> use karein.</p>
    </div>

    {selectedEvent && <div className="card report-scope-note"><strong>Selected program:</strong> {selectedEvent.gujaratiTitle || selectedEvent.title}</div>}
    {error && <div className="login-error">{error}</div>}

    {d && <>
      <div className="grid stats">
        <div className="card"><div className="stat-label">કુલ આવક</div><div className="stat-value">{money(d.summary.income)}</div></div>
        <div className="card"><div className="stat-label">કુલ ખર્ચ</div><div className="stat-value">{money(d.summary.expense)}</div></div>
        <div className="card"><div className="stat-label">બેલેન્સ</div><div className="stat-value">{money(d.summary.balance)}</div></div>
      </div>
      <div className="section"><div className="section-head"><div><p className="eyebrow">BREAKDOWN</p><h2>Category Summary</h2></div></div><div className="grid report-columns"><div className="card"><h3>Income</h3>{d.incomeByCategory.map((x: any) => <div className="summary-row" key={x.category}><span>{x.category}</span><b>{money(x.amount)}</b></div>)}</div><div className="card"><h3>Expenses</h3>{d.expenseByCategory.map((x: any) => <div className="summary-row" key={x.category}><span>{x.category}</span><b>{money(x.amount)}</b></div>)}</div></div></div>
      <div className="section"><div className="section-head"><div><p className="eyebrow">INCOME REGISTER</p><h2>Income Details</h2></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Received From</th><th>Amount</th></tr></thead><tbody>{d.income.map((x: any) => <tr key={x.id}><td>{new Date(x.date).toLocaleDateString('en-IN')}</td><td>{x.category}</td><td>{x.description || '—'}</td><td>{x.receivedFrom || '—'}</td><td><b>{money(x.amountPaise)}</b></td></tr>)}</tbody></table></div></div>
      <div className="section"><div className="section-head"><div><p className="eyebrow">EXPENSE REGISTER</p><h2>Expense Details</h2></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid To</th><th>Amount</th></tr></thead><tbody>{d.expenses.map((x: any) => <tr key={x.id}><td>{new Date(x.date).toLocaleDateString('en-IN')}</td><td>{x.category}</td><td>{x.description || '—'}</td><td>{x.paidTo || '—'}</td><td><b>{money(x.amountPaise)}</b></td></tr>)}</tbody></table></div></div>
    </>}
    <style>{`.report-actions{display:flex;gap:10px;flex-wrap:wrap}.btn-secondary{background:var(--ivory);color:var(--maroon);border:1px solid var(--gold)}.report-scope-note{margin:16px 0;border-left:3px solid var(--gold)}.filter-help{margin:0;color:var(--muted);font-size:12px;align-self:end}@media(max-width:640px){.report-actions{width:100%}.report-actions .btn{flex:1}.filter-help{align-self:auto}}`}</style>
  </div>;
}
