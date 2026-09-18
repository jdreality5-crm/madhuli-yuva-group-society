'use client';
import { FormEvent, useEffect, useState } from 'react';
import { SUBADMIN_PROFILE_TYPES, SUBADMIN_PROFILE_PERMISSIONS, type SubAdminProfileType } from '../../subadmin-profiles';

type User={id:string;name:string;email:string;mobile?:string|null;status:'ACTIVE'|'INACTIVE';createdAt:string;permissions:string[]};
const empty={name:'',email:'',mobile:'',password:'',profileType:'MANAGER' as SubAdminProfileType};

export default function SubAdminsPage(){
  const [users,setUsers]=useState<User[]>([]); const [max,setMax]=useState(6); const [form,setForm]=useState(empty); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  async function load(){const r=await fetch('/api/admin/subadmins'); if(r.ok){const d=await r.json();setUsers(d.users);setMax(d.max)} else setError('Master Admin access required.');}
  useEffect(()=>{load()},[]);
  async function create(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{const r=await fetch('/api/admin/subadmins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not create profile');setForm(empty);setMessage('Sub Admin profile created successfully.');await load()}catch(e){setError(e instanceof Error?e.message:'Something went wrong')}finally{setBusy(false)}}
  async function deactivate(id:string){if(!confirm('Deactivate this Sub Admin profile? They will no longer be able to login.'))return;const r=await fetch(`/api/admin/subadmins/${id}`,{method:'DELETE'});const d=await r.json();if(!r.ok){setError(d.error||'Could not deactivate');return}await load()}
  return <main className="main"><div className="page-title"><div><h1>Sub Admin Management</h1><p>Master Admin control · Maximum {max} Sub Admin profiles</p></div></div>
    {error&&<div className="card" style={{marginBottom:16}}>{error}</div>}{message&&<div className="card" style={{marginBottom:16}}>{message}</div>}
    <div className="grid" style={{gridTemplateColumns:'minmax(280px,380px) 1fr',alignItems:'start'}}>
      <form className="card" onSubmit={create}><h2>Create Sub Admin</h2><p>Only the Master Admin can create these accounts. The six-profile limit is enforced server-side.</p>
        <label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></label>
        <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required /></label>
        <label>Mobile<input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></label>
        <label>Profile Role<select value={form.profileType} onChange={e=>setForm({...form,profileType:e.target.value as SubAdminProfileType})}>{SUBADMIN_PROFILE_TYPES.map(type=><option key={type} value={type}>{type.charAt(0)+type.slice(1).toLowerCase()}</option>)}</select></label><p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6}}>Permissions: {SUBADMIN_PROFILE_PERMISSIONS[form.profileType].map(p=>p.replace('_',' ')).join(', ')}.</p><label>Temporary Password<input type="password" minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required /></label>
        <button className="btn btn-primary" disabled={busy||users.length>=max}>{users.length>=max?'6 / 6 Profiles Used':busy?'Creating…':'Create Sub Admin'}</button>
      </form>
      <section className="card"><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><h2>Sub Admins</h2><strong>{users.length} / {max}</strong></div>
        {users.length===0?<p>No Sub Admin profiles created yet.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.mobile||'—'}</td><td>{u.permissions.includes('EXPENSES')&&u.permissions.includes('EVENTS')?'Manager':u.permissions.includes('EXPENSES')?'Accountant':'Watcher'}</td><td>{u.status}</td><td>{u.status==='ACTIVE'&&<button className="btn" onClick={()=>deactivate(u.id)}>Deactivate</button>}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </main>
}
