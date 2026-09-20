'use client';
import {useEffect,useState} from 'react';

type EventItem={id:string;title:string;gujaratiTitle?:string|null;date:string};

export default function AnnualReports(){
  const [year,setYear]=useState(new Date().getFullYear());
  const [eventId,setEventId]=useState('');
  const [events,setEvents]=useState<EventItem[]>([]);
  const [d,setD]=useState<any>();
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  useEffect(()=>{fetch('/api/admin/events',{cache:'no-store'}).then(async r=>{const x=await r.json().catch(()=>[]);if(r.ok&&Array.isArray(x))setEvents(x)}).catch(()=>{})},[]);
  async function generate(){
    setError('');setLoading(true);setD(undefined);
    try{
      const params=new URLSearchParams({from:`${year}-01-01`,to:`${year}-12-31`});
      if(eventId)params.set('eventId',eventId);
      const r=await fetch(`/api/admin/reports?${params.toString()}`,{cache:'no-store'});
      const x=await r.json().catch(()=>null);
      if(!r.ok){setError(x?.error||`Unable to load report (${r.status})`);return}
      setD(x);
    }catch{setError('Unable to connect to the report service.')}finally{setLoading(false)}
  }
  const money=(v:string)=>`₹ ${(Number(v)/100).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
  function print(){const params=new URLSearchParams({from:`${year}-01-01`,to:`${year}-12-31`});if(eventId)params.set('eventId',eventId);window.open(`/api/admin/reports/print?${params.toString()}`,'_blank','noopener,noreferrer')}
  return <main className="main annual-reports-page"><div className="page-title"><div><p className="eyebrow">ANNUAL • FINANCE</p><h1>વાર્ષિક નાણાકીય રિપોર્ટ</h1><p>વર્ષ અથવા કાર્યક્રમ પ્રમાણે આવક, ખર્ચ અને બેલેન્સનું સંકલિત દૃશ્ય.</p></div><button className="btn btn-secondary" onClick={print}>🖨️ Print / Save PDF</button></div><div className="report-filters card" style={{borderTop:'3px solid var(--gold)'}}><div className="field"><label>Year</label><select className="input" value={year} onChange={e=>setYear(Number(e.target.value))}>{Array.from({length:6},(_,i)=>{const y=new Date().getFullYear()-i;return <option key={y}>{y}</option>})}</select></div><div className="field"><label>Program / Event (optional)</label><select className="input" value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">Full year — all programs</option>{events.map(e=><option key={e.id} value={e.id}>{e.gujaratiTitle||e.title}</option>)}</select></div><button className="btn btn-primary" disabled={loading} onClick={generate}>{loading?'Generating…':'Generate Report'}</button></div>{error&&<div className="login-error">{error}</div>}{d&&<><div className="grid stats"><div className="card"><div className="stat-label">Income</div><div className="stat-value">{money(d.summary.income)}</div></div><div className="card"><div className="stat-label">Expense</div><div className="stat-value">{money(d.summary.expense)}</div></div><div className="card"><div className="stat-label">Balance</div><div className="stat-value">{money(d.summary.balance)}</div></div></div><div className="section"><div className="section-head"><div><p className="eyebrow">REPORT BREAKDOWN</p><h2>{year} — {eventId?'Event':'Annual'} Category Breakdown</h2></div></div><div className="grid report-columns"><div className="card"><h3>Income</h3>{d.incomeByCategory.map((x:any)=><div className="summary-row" key={x.category}><span>{x.category}</span><b>{money(x.amount)}</b></div>)}</div><div className="card"><h3>Expense</h3>{d.expenseByCategory.map((x:any)=><div className="summary-row" key={x.category}><span>{x.category}</span><b>{money(x.amount)}</b></div>)}</div></div></div></>}</main>}
