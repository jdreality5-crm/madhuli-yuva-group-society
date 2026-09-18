'use client';
import { useEffect, useState } from 'react';

type Notice = { id:string; title:string; gujaratiTitle?:string|null; content:string; gujaratiContent?:string|null; date:string; important:boolean; status:'DRAFT'|'PUBLISHED' };

export default function NoticesPage(){
  const [items,setItems]=useState<Notice[]>([]);
  const [form,setForm]=useState({title:'',gujaratiTitle:'',content:'',gujaratiContent:'',date:new Date().toISOString().slice(0,10),important:false,status:'DRAFT'});
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [preview,setPreview]=useState(false);

  async function load(){setLoading(true);const r=await fetch('/api/admin/notices');const x=await r.json();if(r.ok)setItems(Array.isArray(x)?x:[]);else setError(x.error||'Unable to load notices');setLoading(false)}
  useEffect(()=>{load()},[]);
  async function save(){
    if(!form.title.trim()||!form.content.trim()) return setError('Title and notice content are required.');
    setSaving(true);setError('');
    const r=await fetch('/api/admin/notices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,date:new Date(form.date).toISOString()})});
    const x=await r.json(); if(!r.ok){setError(x.error||'Unable to create notice');setSaving(false);return}
    setItems(v=>[x,...v]);setForm(v=>({...v,title:'',gujaratiTitle:'',content:'',gujaratiContent:'',important:false,status:'DRAFT'}));setSaving(false);setPreview(false);
  }
  return <main className="main notices-page">
    <div className="page-title"><div><p className="eyebrow">COMMUNITY • NOTICES</p><h1>Notices / જાહેર સૂચના</h1><p>Create society notices using the original Madhuli Yuva Group letterhead.</p></div><button className="btn btn-secondary" onClick={load}>↻ Refresh</button></div>
    {error&&<div className="login-error">{error}</div>}
    <div className="notice-layout">
      <section className="card notice-editor">
        <div className="section-head"><div><p className="eyebrow">NOTICE COMPOSER</p><h2>નવી સૂચના</h2></div></div>
        <div className="notice-form-grid">
          <div className="field"><label>English Title</label><input className="input" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
          <div className="field"><label>Gujarati Title</label><input className="input" value={form.gujaratiTitle} onChange={e=>setForm({...form,gujaratiTitle:e.target.value})}/></div>
          <div className="field"><label>Date</label><input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
          <div className="field"><label>Status</label><select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value as any})}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></select></div>
        </div>
        <div className="field"><label>English Notice</label><textarea className="input notice-textarea" value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></div>
        <div className="field"><label>Gujarati Notice</label><textarea className="input notice-textarea" value={form.gujaratiContent} onChange={e=>setForm({...form,gujaratiContent:e.target.value})}/></div>
        <label className="notice-check"><input type="checkbox" checked={form.important} onChange={e=>setForm({...form,important:e.target.checked})}/> Mark as important notice</label>
        <div className="notice-actions"><button className="btn btn-secondary" onClick={()=>setPreview(v=>!v)}>{preview?'Hide Preview':'Preview Letterhead'}</button><button className="btn btn-primary" disabled={saving} onClick={save}>{saving?'Saving…':'Create Notice'}</button></div>
      </section>
      {preview&&<section className="notice-preview-wrap"><div className="notice-paper" style={{backgroundImage:"url('/letterhead.jpg')"}}><div className="notice-paper-content"><div className="notice-paper-date">{new Date(form.date).toLocaleDateString('en-IN')}</div><h2>{form.gujaratiTitle||form.title||'જાહેર સૂચના'}</h2><p>{form.gujaratiContent||form.content||'અહીં સૂચનાનો વિષય લખવામાં આવશે.'}</p></div></div></section>}
    </div>
    <section className="section"><div className="section-head"><div><p className="eyebrow">NOTICE REGISTER</p><h2>Saved Notices</h2></div><span className="page-meta">{items.length} notices</span></div>{loading?<div className="card">Loading…</div>:items.length===0?<div className="card empty-state">No notices created yet.</div>:<div className="notice-register">{items.map(n=><article className="card notice-row" key={n.id}><div><span className={'status-pill '+n.status.toLowerCase()}>{n.status}</span>{n.important&&<span className="important-pill">IMPORTANT</span>}<h3>{n.gujaratiTitle||n.title}</h3><p>{n.gujaratiContent||n.content}</p></div><div className="notice-row-actions"><time>{new Date(n.date).toLocaleDateString('en-IN')}</time><button className="btn btn-secondary btn-sm" onClick={()=>window.open('/api/admin/notices/print?id='+encodeURIComponent(n.id),'_blank','noopener,noreferrer')}>🖨️ Print</button></div></article>)}</div>}</section>
    <style>{`.notice-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.8fr);gap:18px}.notice-editor{border-top:3px solid var(--gold)}.notice-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.notice-textarea{min-height:130px;resize:vertical}.notice-check{display:flex;gap:8px;align-items:center;color:var(--muted);font-size:14px;margin:12px 0}.notice-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}.notice-preview-wrap{min-width:0}.notice-paper{position:relative;min-height:520px;background-size:100% 100%;background-position:center;background-repeat:no-repeat;box-shadow:0 18px 45px rgba(66,19,28,.14);border-radius:8px;overflow:hidden}.notice-paper-content{position:absolute;left:14%;right:14%;top:27%;bottom:13%;padding:18px 22px;background:rgba(255,255,255,.96);overflow:auto}.notice-paper-content h2{text-align:center;color:var(--maroon);margin:18px 0 14px;font-family:var(--font-gujarati),sans-serif}.notice-paper-content p{white-space:pre-wrap;line-height:1.8;color:var(--ink);font-family:var(--font-gujarati),var(--font-inter),sans-serif}.notice-paper-date{text-align:right;color:var(--muted);font-size:13px}.notice-register{display:grid;gap:12px}.notice-row{display:flex;justify-content:space-between;gap:18px;border-left:3px solid var(--gold)}.notice-row h3{margin:9px 0 5px;color:var(--maroon)}.notice-row p{margin:0;color:var(--muted);white-space:pre-wrap;line-height:1.6}.notice-row-actions{display:flex;align-items:center;gap:10px}.btn-sm{padding:8px 11px;font-size:12px}.notice-row time{white-space:nowrap;color:var(--muted);font-size:13px}.status-pill,.important-pill{display:inline-block;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:800;margin-right:6px}.status-pill.published{background:#e9f5ec;color:#216a35}.status-pill.draft{background:var(--soft-surface);color:var(--muted)}.important-pill{background:var(--gold-highlight);color:var(--maroon)}@media(max-width:900px){.notice-layout{grid-template-columns:1fr}.notice-preview-wrap{order:2}}@media(max-width:600px){.notice-form-grid{grid-template-columns:1fr}.notice-paper{min-height:460px}.notice-paper-content{left:10%;right:10%;top:25%;bottom:12%;padding:12px}.notice-actions .btn{width:100%}.notice-row{flex-direction:column}.notice-row time{white-space:normal}}`}</style>
  </main>
}
