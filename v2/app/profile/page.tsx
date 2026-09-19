"use client";

import { UiIcon } from "@/components/UiIcon";
import { useEffect, useMemo, useState } from "react";

type Profile = {
  id:string; name:string; email:string; mobile:string|null; role:string;
  profileImageUrl:string|null; residentType:string|null; status:string;
  approvalStatus:string; emailVerified:boolean; emailLockedUntil:string|null;
  mobileLockedUntil:string|null; unit:any;
};
type Tab = "general"|"residence"|"account";

function formatDate(value:string|null) {
  if(!value) return "—";
  const d=new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}

export default function ProfilePage() {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false);
  const [editing,setEditing]=useState(false),[tab,setTab]=useState<Tab>("general");
  const [message,setMessage]=useState(""),[error,setError]=useState("");

  async function load() {
    setLoading(true);setError("");
    try {
      const r=await fetch("/api/profile",{cache:"no-store"});const d=await r.json().catch(()=>({}));
      if(!r.ok) throw Error(d.error||"Unable to load profile");setProfile(d.profile);
    } catch(e:any){setError(e.message||"Unable to load profile")} finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);

  async function save() {
    if(!profile) return;
    if(!profile.name.trim()) return setError("Name is required.");
    if(!profile.mobile?.trim()) return setError("Mobile number is required.");
    setSaving(true);setError("");setMessage("");
    try {
      const r=await fetch("/api/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:profile.name,mobile:profile.mobile,email:profile.email})});
      const d=await r.json().catch(()=>({}));if(!r.ok) throw Error(d.error||"Unable to update profile");
      setProfile(p=>p?{...p,...d.profile}:p);setEditing(false);setMessage("Profile updated successfully.");
    } catch(e:any){setError(e.message||"Unable to update profile")} finally{setSaving(false)}
  }

  async function upload(file:File) {
    setUploading(true);setError("");setMessage("");
    try {
      const f=new FormData();f.append("file",file);const r=await fetch("/api/profile",{method:"POST",body:f});
      const d=await r.json().catch(()=>({}));if(!r.ok) throw Error(d.error||"Unable to upload profile picture");
      setProfile(p=>p?{...p,profileImageUrl:d.profileImageUrl}:p);setMessage("Profile picture updated.");
    } catch(e:any){setError(e.message||"Unable to upload profile picture")} finally{setUploading(false)}
  }

  async function removePhoto() {
    if(!profile?.profileImageUrl||!confirm("Remove your profile picture?")) return;
    setUploading(true);setError("");setMessage("");
    try {
      const r=await fetch("/api/profile",{method:"DELETE"});const d=await r.json().catch(()=>({}));
      if(!r.ok) throw Error(d.error||"Unable to remove profile picture");
      setProfile(p=>p?{...p,profileImageUrl:null}:p);setMessage("Profile picture removed.");
    } catch(e:any){setError(e.message||"Unable to remove profile picture")} finally{setUploading(false)}
  }

  const residence=useMemo(()=>{
    const unit=profile?.unit;if(!unit?.property) return null;
    if(unit.property.type==="APARTMENT") return {
      title:"Block "+(unit.property.block||unit.property.propertyNumber)+" · Flat "+unit.label,
      property:unit.property.name,type:profile?.residentType==="TENANT"?"Tenant / Rental":"Owner",detail:"Sarang Apartment"
    };
    if(unit.property.type==="TENAMENT") return {
      title:"Tenament "+unit.property.propertyNumber,property:unit.property.name,
      type:profile?.residentType==="TENANT"?"Tenant / Rental":"Owner",detail:unit.floorLabel||unit.label||"Floor not assigned"
    };
    return null;
  },[profile]);

  if(loading) return <main className="main profile-page"><div className="profile-loading card"><div className="loading-mark">S</div><strong>Loading your profile…</strong></div></main>;
  if(!profile) return <main className="main profile-page"><div className="card profile-error"><strong>{error||"Profile unavailable."}</strong><button className="btn btn-secondary" onClick={load}>Try again</button></div></main>;

  return <main className="main profile-page">
    <div className="page-title"><div><p className="eyebrow">MY ACCOUNT • PROFILE</p><h1>My Profile</h1><p>તમારી વ્યક્તિગત માહિતી અને સોસાયટી રેકોર્ડ મેનેજ કરો.</p></div><a className="page-meta profile-back" href="/">← Dashboard</a></div>
    {(error||message)&&<div className={error?"profile-alert error":"profile-alert success"} role="status">{error||message}</div>}

    <section className="profile-hero card">
      <div className="profile-cover"><div className="cover-pattern"/></div>
      <div className="profile-identity">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">{profile.profileImageUrl?<img src={profile.profileImageUrl} alt={profile.name+" profile"}/>:<span>{profile.name.slice(0,1).toUpperCase()}</span>}</div>
          <label className="avatar-camera" title="Update profile picture"><UiIcon name="camera" size={15}/><input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.currentTarget.value=""}}/></label>
        </div>
        <div className="identity-copy"><h2>{profile.name}</h2><p>{profile.email}</p><div className="identity-badges"><span className="identity-badge">{profile.role.replace(/_/g," ")}</span>{profile.residentType&&<span className="identity-badge soft">{profile.residentType==="TENANT"?"Tenant":"Owner"}</span>}</div></div>
        <div className="profile-actions"><label className="btn btn-secondary photo-btn"><UiIcon name="camera" size={15}/>{uploading?"Uploading…":"Change Photo"}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.currentTarget.value=""}}/></label>{profile.profileImageUrl&&<button className="btn btn-secondary" disabled={uploading} onClick={removePhoto}>Remove</button>}<button className="btn btn-primary" onClick={()=>{setEditing(v=>!v);setTab("general")}}>{editing?"Close Edit":"Edit Profile"}</button></div>
      </div>
      <div className="profile-photo-note">JPG, PNG or WebP · maximum 3 MB · profile pictures are stored privately.</div>
    </section>

    <section className="profile-layout">
      <div className="profile-tabs card" role="tablist">
        <button className={tab==="general"?"active":""} onClick={()=>setTab("general")} role="tab">General</button>
        <button className={tab==="residence"?"active":""} onClick={()=>setTab("residence")} role="tab">Residence</button>
        <button className={tab==="account"?"active":""} onClick={()=>setTab("account")} role="tab">Account</button>
      </div>

      <section className="profile-content card">
        {tab==="general"&&<div><div className="content-heading"><div><p className="eyebrow">PERSONAL DETAILS</p><h2>Profile information</h2><p>તમારું નામ અને મોબાઇલ નંબર અપડેટ કરી શકો છો.</p></div>{!editing&&<button className="btn btn-secondary" onClick={()=>setEditing(true)}>Edit Profile</button>}</div>
          <div className="profile-form-grid">
            <label>Full name<input className="input" disabled={!editing} value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label>
            <label>Mobile number *<input className="input" disabled={!editing} value={profile.mobile||""} onChange={e=>setProfile({...profile,mobile:e.target.value})}/>{profile.mobileLockedUntil&&new Date(profile.mobileLockedUntil)>new Date()&&<small className="field-note">Mobile changes are locked until {formatDate(profile.mobileLockedUntil)}.</small>}</label>
            <label>Email address<input className="input" value={profile.email} readOnly/><small className="field-note">Email changes require a separate verification flow.</small></label>
            <label>Resident type<input className="input" value={profile.residentType==="TENANT"?"Tenant / Rental":"Owner"} readOnly/></label>
          </div>
          {editing&&<div className="actions profile-save-actions"><button className="btn btn-secondary" onClick={()=>{setEditing(false);load()}}>Cancel</button><button className="btn btn-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save Changes"}</button></div>}
        </div>}

        {tab==="residence"&&<div><div className="content-heading"><div><p className="eyebrow">SOCIETY RECORD</p><h2>Your residence</h2><p>તમારા account સાથે જોડાયેલ સોસાયટી અને residence details.</p></div></div>
          {residence?<div className="residence-detail-grid"><div className="detail-tile"><span>Residence</span><strong>{residence.title}</strong><small>{residence.detail}</small></div><div className="detail-tile"><span>Society</span><strong>{residence.property}</strong><small>{residence.type}</small></div><div className="detail-tile"><span>Resident type</span><strong>{residence.type}</strong><small>Verified society record</small></div><div className="detail-tile"><span>Access</span><strong>Active</strong><small>Residence linked to your account</small></div></div>:<div className="profile-empty">Residence information is not linked to this account yet.</div>}
        </div>}

        {tab==="account"&&<div><div className="content-heading"><div><p className="eyebrow">ACCOUNT STATUS</p><h2>Security & verification</h2><p>Your account state and verification information.</p></div></div>
          <div className="account-status-grid">
            <div className="status-row"><span>Email verification</span><strong className={profile.emailVerified?"ok":"pending"}>{profile.emailVerified?"Verified":"Pending"}</strong></div>
            <div className="status-row"><span>Account status</span><strong className={profile.status==="ACTIVE"?"ok":"pending"}>{profile.status}</strong></div>
            <div className="status-row"><span>Approval status</span><strong>{profile.approvalStatus}</strong></div>
            <div className="status-row"><span>Mobile lock</span><strong>{profile.mobileLockedUntil&&new Date(profile.mobileLockedUntil)>new Date()?"Locked until "+formatDate(profile.mobileLockedUntil):"Available"}</strong></div>
            <div className="status-row"><span>Email lock</span><strong>{profile.emailLockedUntil&&new Date(profile.emailLockedUntil)>new Date()?"Locked until "+formatDate(profile.emailLockedUntil):"Available"}</strong></div>
          </div>
          <div className="account-note"><strong>Password</strong><span>Use the Forgot Password flow from the sign-in page to change a forgotten password securely.</span><a href="/forgot-password">Open password recovery</a></div>
        </div>}
      </section>
    </section>

    <style jsx>{`
      .profile-page{max-width:1180px}.profile-back{text-decoration:none}.profile-alert{border-radius:12px;padding:12px 14px;margin:-8px 0 18px;font-size:12px}.profile-alert.error{background:#f9e7e7;color:#8b2635}.profile-alert.success{background:#eaf5ee;color:#24633c}
      .profile-hero{padding:0;overflow:hidden;border-top:3px solid var(--gold)}.profile-cover{height:150px;position:relative;background:radial-gradient(circle at 82% 22%,rgba(231,213,168,.26),transparent 25%),linear-gradient(115deg,#42131c,#641d2a 65%,#7a2938)}.cover-pattern{position:absolute;inset:0;background:radial-gradient(circle at 20% 70%,transparent 0 38px,rgba(231,213,168,.10) 39px 40px,transparent 41px),radial-gradient(circle at 82% 20%,transparent 0 75px,rgba(231,213,168,.08) 76px 77px,transparent 78px);opacity:.9}
      .profile-identity{display:flex;align-items:flex-end;gap:20px;padding:0 28px 20px;position:relative;margin-top:-50px}.profile-avatar-wrap{position:relative;flex:0 0 auto}.profile-avatar{width:118px;height:118px;border-radius:50%;border:5px solid #fff;background:#f1e8da;color:var(--maroon);display:grid;place-items:center;overflow:hidden;box-shadow:0 10px 28px rgba(53,21,26,.18);font-size:42px;font-weight:800}.profile-avatar img{width:100%;height:100%;object-fit:cover}.avatar-camera{position:absolute;right:4px;bottom:5px;width:31px;height:31px;border-radius:50%;background:var(--maroon);color:#fff;border:3px solid #fff;display:grid;place-items:center;cursor:pointer}
      .identity-copy{min-width:0;padding-bottom:5px}.identity-copy h2{font-family:var(--font-playfair),Georgia,serif;color:var(--maroon);font-size:26px;margin:0}.identity-copy p{font-size:12px;color:var(--muted);margin:4px 0 8px;overflow:hidden;text-overflow:ellipsis}.identity-badges{display:flex;gap:7px;flex-wrap:wrap}.identity-badge{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;background:var(--maroon);color:#fff;border-radius:999px;padding:6px 9px}.identity-badge.soft{background:var(--maroon-soft);color:var(--maroon)}
      .profile-actions{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;padding-bottom:4px}.photo-btn{display:inline-flex;align-items:center;gap:6px}.profile-photo-note{padding:0 28px 18px 166px;color:#958a82;font-size:10px}
      .profile-layout{display:grid;grid-template-columns:205px minmax(0,1fr);gap:16px;margin-top:18px;align-items:start}.profile-tabs{padding:8px;display:grid;gap:5px;position:sticky;top:88px}.profile-tabs button{border:0;background:transparent;text-align:left;border-radius:10px;padding:12px 13px;color:#6b6059;font-weight:700;font-size:12px;cursor:pointer}.profile-tabs button:hover{background:var(--surface-soft);color:var(--maroon)}.profile-tabs button.active{background:var(--maroon-soft);color:var(--maroon)}
      .profile-content{min-height:360px}.content-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:22px}.content-heading h2{margin:0;color:var(--maroon);font-size:21px}.content-heading p:not(.eyebrow){color:var(--muted);font-size:12px;margin:5px 0 0}.profile-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.profile-form-grid label{font-size:12px;font-weight:700;color:#514a46}.profile-form-grid .input{margin-top:6px}.profile-form-grid .input:disabled{background:#f7f3ee;color:#655c56}.field-note{display:block;color:#9a8d83;font-size:9px;font-weight:500;margin-top:5px;line-height:1.4}.profile-save-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:22px}
      .residence-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.detail-tile{padding:17px;border:1px solid var(--line);border-radius:13px;background:#fffaf5}.detail-tile span{display:block;color:#9a8d83;font-size:9px;text-transform:uppercase;letter-spacing:1px;font-weight:800}.detail-tile strong{display:block;color:var(--maroon);font-size:15px;margin-top:7px}.detail-tile small{display:block;color:var(--muted);font-size:10px;margin-top:3px}.profile-empty{border:1px dashed #d8ccc0;border-radius:13px;background:#fcfaf6;color:var(--muted);padding:30px;text-align:center;font-size:12px}
      .account-status-grid{border:1px solid var(--line);border-radius:13px;overflow:hidden}.status-row{display:flex;justify-content:space-between;gap:20px;padding:14px 16px;border-bottom:1px solid var(--line);font-size:12px}.status-row:last-child{border-bottom:0}.status-row span{color:var(--muted)}.status-row strong{color:var(--maroon)}.status-row strong.ok{color:#2e7049}.status-row strong.pending{color:#9a6b25}.account-note{margin-top:16px;padding:16px;border-radius:13px;background:var(--surface-soft);display:grid;gap:5px}.account-note strong{color:var(--maroon);font-size:12px}.account-note span{font-size:11px;color:var(--muted);line-height:1.6}.account-note a{font-size:11px;color:var(--maroon);font-weight:800}
      .profile-loading{min-height:320px;display:grid;place-items:center;text-align:center;gap:8px}.profile-loading .loading-mark{margin:auto}.profile-error{display:flex;align-items:center;justify-content:space-between;gap:20px}
      @media(max-width:820px){.profile-identity{align-items:flex-start;flex-wrap:wrap;padding:0 20px 20px}.profile-actions{margin-left:0;width:100%;justify-content:flex-start}.profile-photo-note{padding:0 20px 18px}.profile-layout{grid-template-columns:1fr}.profile-tabs{position:static;grid-template-columns:repeat(3,1fr)}.profile-tabs button{text-align:center}.profile-form-grid,.residence-detail-grid{grid-template-columns:1fr}}
      @media(max-width:560px){.profile-cover{height:125px}.profile-avatar{width:96px;height:96px}.profile-identity{margin-top:-42px;gap:13px}.identity-copy h2{font-size:22px}.profile-actions .btn{flex:1}.profile-content{padding:16px}.content-heading{flex-direction:column}.profile-tabs{padding:6px}.profile-tabs button{padding:10px 5px;font-size:10px}}
    `}</style>
  </main>;
}
