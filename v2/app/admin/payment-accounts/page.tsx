'use client';
import {useEffect,useState} from 'react';
import '../../globals.css';

type Account={id:string;displayName:string;upiId?:string|null;purpose:string;instructions?:string|null;qrImageUrl?:string|null};

export default function PaymentAccounts(){
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [displayName,setDisplayName]=useState('');
  const [upiId,setUpiId]=useState('');
  const [purpose,setPurpose]=useState('');
  const [instructions,setInstructions]=useState('');
  const [qr,setQr]=useState('');
  const [msg,setMsg]=useState('');
  async function load(){const r=await fetch('/api/admin/payment-accounts');if(r.ok){const x=await r.json();setAccounts(x.accounts||[])}}
  useEffect(()=>{load()},[]);
  async function uploadQr(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024)return setMsg('QR image must be under 5 MB.');if(!['image/jpeg','image/png','image/webp'].includes(f.type))return setMsg('QR must be JPG, PNG or WEBP.');setMsg('Uploading QR…');const form=new FormData();form.append('file',f);form.append('folder','payment-qrs');const r=await fetch('/api/storage/upload',{method:'POST',body:form});const x=await r.json();if(!r.ok)return setMsg(x.error||'QR upload failed.');setQr(x.path);setMsg('QR uploaded securely.')}
  async function create(e:React.FormEvent){e.preventDefault();setMsg('');const r=await fetch('/api/admin/payment-accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName,upiId,purpose,instructions,qrImageUrl:qr})});const x=await r.json();if(!r.ok)return setMsg(x.error||'Could not create payment account.');setMsg('Payment account created.');setDisplayName('');setUpiId('');setPurpose('');setInstructions('');setQr('');load()}
  return <main className="main"><div className="page-title"><div><h1>UPI Payment Accounts</h1><p>Master Admin controls the society payment receivers.</p></div></div><form className="card grid" onSubmit={create}><h2>Add payment account</h2><input className="input" required placeholder="Display name" value={displayName} onChange={e=>setDisplayName(e.target.value)}/><input className="input" placeholder="UPI ID e.g. society@upi" value={upiId} onChange={e=>setUpiId(e.target.value)}/><input className="input" required placeholder="Purpose / receiver" value={purpose} onChange={e=>setPurpose(e.target.value)}/><textarea className="input" placeholder="Payment instructions" value={instructions} onChange={e=>setInstructions(e.target.value)}/><label>UPI QR image<input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadQr}/></label>{qr&&<p>✓ QR uploaded securely</p>}<button className="btn btn-primary" disabled={!qr&&false}>Create Account</button></form>{msg&&<div className="card">{msg}</div>}<section className="grid">{accounts.map(a=><article className="card" key={a.id}><h3>{a.displayName}</h3><p><b>Purpose:</b> {a.purpose}</p><p><b>UPI:</b> {a.upiId||'—'}</p>{a.qrImageUrl&&<img src={a.qrImageUrl} alt="UPI QR" style={{width:180,height:180,objectFit:'contain'}}/>}</article>)}</section></main>
}
