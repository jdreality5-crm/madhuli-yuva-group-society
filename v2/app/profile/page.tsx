"use client";

import { useEffect, useState } from "react";

type Profile = { id:string; name:string; email:string; mobile:string|null; role:string; profileImageUrl:string|null; residentType:string|null; unit:any };

export default function ProfilePage(){
  const [profile,setProfile]=useState<Profile|null>(null); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [uploading,setUploading]=useState(false); const [message,setMessage]=useState("");
  async function load(){try{const r=await fetch('/api/profile',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setProfile(d.profile);}catch(e:any){setMessage(e.message||'Unable to load profile')}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function save(){if(!profile?.mobile?.trim()){setMessage('Mobile number is required.');return}setSaving(true);setMessage('');try{const r=await fetch('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:profile.name,mobile:profile.mobile,email:profile.email})});const d=await r.json();if(!r.ok)throw Error(d.error);setProfile(p=>p?{...p,...d.profile}:p);setMessage('Profile updated successfully.')}catch(e:any){setMessage(e.message||'Unable to update profile')}finally{setSaving(false)}}
  async function upload(file:File){setUploading(true);setMessage('');try{const f=new FormData();f.append('file',file);const r=await fetch('/api/profile',{method:'POST',body:f});const d=await r.json();if(!r.ok)throw Error(d.error);setProfile(p=>p?{...p,profileImageUrl:d.profileImageUrl}:p);setMessage('Profile picture updated.')}catch(e:any){setMessage(e.message||'Unable to upload image')}finally{setUploading(false)}}
  async function remove(){if(!confirm('Remove your profile picture?'))return;setUploading(true);try{const r=await fetch('/api/profile',{method:'DELETE'});const d=await r.json();if(!r.ok)throw Error(d.error);setProfile(p=>p?{...p,profileImageUrl:null}:p);setMessage('Profile picture removed.')}catch(e:any){setMessage(e.message||'Unable to remove image')}finally{setUploading(false)}}
  if(loading)return <main className="main"><div className="card">Loading profile…</div></main>;
  if(!profile)return <main className="main"><div className="card">{message||'Profile unavailable.'}</div></main>;
  const unit=profile.unit;
  const residence = unit?.property?.type==='APARTMENT'
    ? `Block ${unit.property.block || unit.property.propertyNumber} · Flat ${unit.label}`
    : unit?.property?.type==='TENAMENT'
      ? `Tenament ${unit.property.propertyNumber} · ${unit.floorLabel || unit.label}`
      : null;
  return <main className="main"><div className="page-title"><div><p className="eyebrow">ACCOUNT • PROFILE</p><h1>My Profile</h1><p>Manage your personal details and profile picture.</p></div><div className="page-meta">{profile.role.replace("_"," ")}</div></div>{message&&<div className="alert">{message}</div>}
    <section className="card profile-card"><div className="section-head"><div><p className="eyebrow">PERSONAL DETAILS</p><h2>Profile & identity</h2></div></div><div className="profile-top"><div className="avatar">{profile.profileImageUrl?<img src={profile.profileImageUrl} alt="Profile"/>:profile.name.slice(0,1).toUpperCase()}</div><div><h2>{profile.name}</h2><p>{profile.role.replace('_',' ')}</p><div className="actions"><label className="btn btn-secondary">📷 Take Photo<input hidden type="file" accept="image/*" capture="user" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.currentTarget.value=''}}/></label><label className="btn btn-secondary">{uploading?'Uploading…':'Choose Photo'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.currentTarget.value=''}}/></label>{profile.profileImageUrl&&<button className="btn btn-secondary" disabled={uploading} onClick={remove}>Remove</button>}</div><small>JPG, PNG or WebP · maximum 3 MB</small></div></div>
    <div className="form-grid"><label>Name<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>Mobile *<input required value={profile.mobile||''} onChange={e=>setProfile({...profile,mobile:e.target.value})}/></label><label>Email<input type="email" value={profile.email} readOnly aria-readonly="true"/></label></div>
    {unit&&residence&&<div className="resident-box"><p className="eyebrow">SOCIETY RECORD</p><h3>Residence</h3><p><strong>{residence}</strong></p><p>{unit.property.name} · {profile.residentType||'Resident'}</p></div>}
    <div className="actions"><button className="btn btn-primary" disabled={saving} onClick={save}>{saving?'Saving…':'Save Profile'}</button></div></section>
    <style jsx>{`.profile-card{max-width:900px;border-top:3px solid var(--gold)}.profile-top{display:flex;gap:24px;align-items:center;margin-bottom:28px}.avatar{width:112px;height:112px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#f1e8da;color:#6d2030;font-size:42px;font-weight:700}.avatar img{width:100%;height:100%;object-fit:cover}.resident-box{margin:24px 0;padding:16px;border:1px solid #eadfce;border-radius:12px;background:#fffaf2}@media(max-width:600px){.profile-top{align-items:flex-start;flex-direction:column}}`}</style></main>
}
