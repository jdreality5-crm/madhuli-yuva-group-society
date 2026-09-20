'use client';

import { useEffect, useState } from 'react';
import { UiIcon } from '@/components/UiIcon';

type Program = {
  id: string;
  title: string;
  gujaratiTitle?: string | null;
  date: string;
  time?: string | null;
  location?: string | null;
  type?: string | null;
  description?: string | null;
  status: string;
};

const initialForm = () => ({
  title: '',
  gujaratiTitle: '',
  date: new Date().toISOString().slice(0, 10),
  time: '',
  location: '',
  type: '',
  description: '',
  status: 'PUBLISHED',
  visibility: 'OWNER',
});

export default function Programs() {
  const [rows, setRows] = useState<Program[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch('/api/admin/events', { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    if (response.ok && Array.isArray(body)) {
      setRows(body);
      return;
    }
    setError(body?.error || 'Unable to load programs');
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!form.date) {
      setError('Please select a program date.');
      return;
    }

    const parsedDate = new Date(`${form.date}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      setError('Please enter a valid program date.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          gujaratiTitle: form.gujaratiTitle.trim() || undefined,
          time: form.time.trim() || undefined,
          location: form.location.trim() || undefined,
          type: form.type.trim() || undefined,
          description: form.description.trim() || undefined,
          date: parsedDate.toISOString(),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error || `Could not save program (${response.status})`);
        return;
      }
      setForm(initialForm());
      await load();
    } catch {
      setError('Network error. Please check the live configuration and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="main">
      <div className="page-title"><div><p className="eyebrow">SOCIETY • PROGRAMS</p><h1>Programs / કાર્યક્રમો</h1><p>Upcoming society functions અને events manage કરો.</p></div></div>
      <div className="card program-form" style={{ marginBottom: 18 }}>
        <div className="section-head"><div><p className="eyebrow">CREATE • SCHEDULE</p><h2>Add Society Program</h2><p className="section-subtitle">Create an event residents can discover from the dashboard.</p></div></div>
        <form onSubmit={save} className="form-grid">
          <div className="field"><label>Program Title</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label>Gujarati Title</label><input className="input" value={form.gujaratiTitle} onChange={(e) => setForm({ ...form, gujaratiTitle: e.target.value })} /></div>
          <div className="field"><label>Date</label><input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div className="field"><label>Time</label><input className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          <div className="field"><label>Location</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="field"><label>Type</label><input className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></div>
          <div className="field"><label>Status</label><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>PUBLISHED</option><option>DRAFT</option></select></div>
          <div className="field" style={{ gridColumn: '1/-1' }}><label>Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={saving}><UiIcon name="add" size={17} /> {saving ? 'Saving...' : 'Add Program'}</button>
        </form>
        {error && <p className="login-error">{error}</p>}
      </div>
      <div className="program-grid">{rows.map((row) => <article className="card program-card" key={row.id}><div className="program-top"><span className="badge">{row.status}</span><span className="program-type">{row.type || 'Society Event'}</span></div><h3>{row.gujaratiTitle || row.title}</h3>{row.gujaratiTitle && <p className="program-en">{row.title}</p>}<div className="program-meta"><span><UiIcon name="calendar" size={15} /> {new Date(row.date).toLocaleDateString('en-IN')}</span><span><UiIcon name="refresh" size={15} /> {row.time || 'Time TBA'}</span><span><UiIcon name="property" size={15} /> {row.location || 'Location TBA'}</span></div>{row.description && <p className="program-desc">{row.description}</p>}</article>)}{!rows.length && <div className="card">No programs added yet.</div>}</div>
    </div>
  );
}

const programStyle = `.program-form{border-top:3px solid var(--gold);box-shadow:0 18px 45px rgba(66,19,28,.07)}.program-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.program-card{min-height:190px;transition:transform .2s ease,box-shadow .2s ease;border:1px solid var(--border)}.program-card:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(66,19,28,.1)}.program-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.program-type{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.58}.program-card h3{margin:16px 0 4px;font-size:20px}.program-en{margin:0 0 14px;opacity:.62}.program-meta{display:grid;gap:7px;font-size:13px;color:#746b65}.program-meta span{display:flex;align-items:center;gap:7px}.program-desc{margin-top:14px;padding-top:12px;border-top:1px solid var(--border);font-size:13px;line-height:1.6}.program-grid>.card:not(.program-card){grid-column:1/-1;text-align:center;padding:34px}.program-form .btn{width:max-content}.grid{display:grid;gap:16px}@media(max-width:900px){.program-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.program-grid{grid-template-columns:1fr}.program-form .form-grid{grid-template-columns:1fr}.program-form .form-grid [style*="grid-column"]{grid-column:auto!important}}`;

if (typeof document !== 'undefined' && !document.getElementById('program-page-style')) {
  const style = document.createElement('style');
  style.id = 'program-page-style';
  style.textContent = programStyle;
  document.head.appendChild(style);
}
