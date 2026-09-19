'use client';
import { UiIcon } from '@/components/UiIcon';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Role = 'MASTER_ADMIN' | 'ORGANIZER' | 'OWNER';
type Dashboard = { role: Role; permissions?: string[]; society?: { name: string; city?: string | null; state?: string | null }; stats?: { totalIncome: string; totalExpense: string; balance: string; flats: number; events: number }; upcomingEvents: any[]; notices: any[]; photos: any[] };

const money = (p?: string) => p ? `₹ ${(Number(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ 0.00';

const residentNav = [
  { section: 'My Society', items: [['Dashboard','/','home'],['Programs','/programs','calendar'],['Notices','/notices','notice'],['Gallery','/gallery','gallery']] },
  { section: 'My Account', items: [['Bills','/bills','report'],['Payments','/payments','payment'],['My Profile','/profile','users']] },
] as const;

const primaryLinks = [
  ['Dashboard', '/'],
  ['Properties', '/admin/properties'],
  ['Flats & Owners', '/admin/flats'],
  ['Programs', '/admin/programs'],
] as const;

const permissionLinks = [
  ['Notices', 'NOTICES', '/admin/notices'],
  ['Gallery', 'GALLERY', '/admin/gallery'],
] as const;
const links = [['Owner Approvals', '/admin/owner-approvals'], ['Payment Accounts', '/admin/payment-accounts'], ['Payments', '/admin/payments'], ['Income', '/admin/income'], ['Expenses', '/admin/expenses'], ['Reports', '/reports']] as const;

function roleLabel(role: Role) { return role === 'MASTER_ADMIN' ? 'Master Admin' : role === 'ORGANIZER' ? 'Sub Admin / Organizer' : 'Resident'; }
export default function DashboardPage() {
  const pathname = usePathname();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/dashboard').then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Unable to load dashboard'); setDashboard(data); setUpcoming(data.upcomingEvents ?? []); }).catch(e => setError(e instanceof Error ? e.message : 'Unable to load dashboard')); }, []);
  async function logout() { setLoggingOut(true); await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }
  const notices = dashboard?.notices ?? [];
  const photos = dashboard?.photos ?? [];
  const location = [dashboard?.society?.city, dashboard?.society?.state].filter(Boolean).join(', ');
  const mobileLinks = useMemo(() => dashboard?.role === 'OWNER' ? [['Home', '/'], ['Payment', '/payments'], ['Profile', '/profile']] : [['Home', '/'], ['Programs', '/programs'], ['Notices', '/notices'], ['Bills', '/bills'], ['Gallery', '/gallery'], ['Profile', '/profile']], [dashboard?.role]);

  if (error) return <main className="main"><div className="card"><h1>Dashboard</h1><p>{error}</p><a className="btn btn-primary" href="/login">Sign in</a></div></main>;
  if (!dashboard) return <main className="main"><div className="card"><p>Loading dashboard…</p></div></main>;

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">S</div>
        <div className="brand-copy">{dashboard?.society?.name || 'Society Administration'}<small>સોસાયટી ફંક્શન મેનેજમેન્ટ</small></div>
      </div>
      <span className="role-badge"><span className="role-dot" />{roleLabel(dashboard.role)}</span>
    </header>

    <div className="layout">
      <aside className="sidebar dashboard-sidebar">
        {dashboard.role === 'OWNER' ? (
          residentNav.map((group) => (
            <div className="nav-group" key={group.section}>
              <div className="nav-section">{group.section}</div>
              {group.items.map(([label, url, icon]) => (
                <a className={`nav-item ${pathname === url ? 'active' : ''}`} href={url} key={label}>
                  <span className="nav-icon"><UiIcon name={icon as any} size={15} /></span>
                  <span>{label}</span>
                </a>
              ))}
            </div>
          ))
        ) : (
          <>
            <div className="nav-section">Workspace</div>
            {primaryLinks.map(([label, url], index) => <a className={`nav-item ${pathname === url ? 'active' : ''}`} href={url} key={label}><span className="nav-icon"><UiIcon name={['home','home','users','calendar'][index] as any} size={15}/></span><span>{label}</span></a>)}
            {dashboard.role !== 'OWNER' && permissionLinks.filter(([, permission]) => dashboard.role === 'MASTER_ADMIN' || dashboard.permissions?.includes(permission)).map(([label, , url]) => <a className={`nav-item ${pathname === url ? 'active' : ''}`} href={url} key={label}><span className="nav-icon"><UiIcon name={label === 'Notices' ? 'notice' : 'gallery'} size={15}/></span><span>{label}</span></a>)}
            <div className="nav-section">Administration</div>
            {links.map(([label, url], index) => <a className={`nav-item ${pathname === url ? 'active' : ''}`} href={url} key={label}><span className="nav-icon"><UiIcon name={['check','payment','payment','report','report','report'][index] as any} size={15}/></span><span>{label}</span></a>)}
          </>
        )}
        <div className="nav-spacer" />
        {dashboard.role === 'OWNER' && <div className="sidebar-help"><span className="sidebar-help-icon"><UiIcon name="users" size={15}/></span><strong>Need society help?</strong><small>{dashboard.society?.contact || 'Contact your society administrator.'}</small></div>}
        <button className="nav-item logout-btn" onClick={logout} disabled={loggingOut}><span className="nav-icon"><UiIcon name="arrowRight" size={15}/></span><span>{loggingOut ? 'Logging out…' : 'Logout'}</span></button>
      </aside>

      <main className="main">
        <div className="page-title">
          <div><p className="eyebrow">Society Administration</p><h1>{dashboard?.role === 'MASTER_ADMIN' ? 'Master Admin Dashboard' : dashboard?.role === 'ORGANIZER' ? 'Organizer Dashboard' : 'મારું સોસાયટી ડેશબોર્ડ'}</h1><p>{location || 'Society overview and daily operations'}</p></div>
          <div className="page-meta">{roleLabel(dashboard.role)}</div>
        </div>

        {dashboard?.role === 'MASTER_ADMIN' && <section className="card control-card">
          <div className="section-head"><div><p className="eyebrow">Master Control</p><h2>Society administration at a glance</h2></div><span className="badge">Up to 6 Sub Admins</span></div>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7, marginTop: 0 }}>Manage organizers, financial operations, programs and society records from one secure workspace.</p>
          <a className="btn btn-primary" href="/admin/subadmins">Manage Sub Admins</a>
        </section>}

        {dashboard?.stats && <section className="section">
          <div className="section-head"><div><p className="eyebrow">Overview</p><h2>Society performance</h2></div></div>
          <div className="grid stats">
            <div className="card stat-card"><div className="stat-icon" aria-hidden="true"><UiIcon name="payment" size={18}/></div><div className="stat-label">Total Income</div><div className="stat-value">{money(dashboard.stats.totalIncome)}</div><div className="stat-note">Recorded receipts</div></div>
            <div className="card stat-card"><div className="stat-icon" aria-hidden="true"><UiIcon name="report" size={18}/></div><div className="stat-label">Total Expense</div><div className="stat-value">{money(dashboard.stats.totalExpense)}</div><div className="stat-note">Recorded expenditure</div></div>
            <div className="card stat-card"><div className="stat-icon" aria-hidden="true"><UiIcon name="check" size={18}/></div><div className="stat-label">Current Balance</div><div className="stat-value">{money(dashboard.stats.balance)}</div><div className="stat-note">Income less expenses</div></div>
            <div className="card stat-card"><div className="stat-icon" aria-hidden="true"><UiIcon name="home" size={18}/></div><div className="stat-label">Active Flats</div><div className="stat-value">{dashboard.stats.flats}</div><div className="stat-note">Society records</div></div>
          </div>
        </section>}

        <section className="section quick-actions">
          <div className="section-head"><div><p className="eyebrow">Quick access</p><h2>Common actions</h2></div><span className="section-subtitle">Secure workspace</span></div>
          <div className="quick-action-grid">
            {(dashboard?.role === 'OWNER' ? [['Make a Payment','Pay society dues securely','/payments','payment'],['My Profile','Update your profile','/profile','users']] : [['Add / Manage Residents','Manage flats and resident records','/admin/flats','users'],['Create Program','Plan an upcoming society program','/admin/programs','calendar'],['Post Notice','Share an important society update','/admin/notices','notice'],['View Reports','Review authorized financial reports','/reports','report']]).map(([title,desc,url,icon]) => <a className="card quick-action" href={url} key={title}><span className="quick-icon"><UiIcon name={icon as any} size={18}/></span><span><strong>{title}</strong><small>{desc}</small></span><span aria-hidden="true" className="quick-arrow"><UiIcon name="add" size={16}/></span></a>)}
          </div>
        </section>

        <section className="section">
          <div className="section-head"><div><p className="eyebrow">Calendar</p><h2>Upcoming Programs / આગામી કાર્યક્રમો</h2></div><span className="section-subtitle">{upcoming.length} upcoming</span></div>
          {upcoming.length ? <div className="grid event-grid">{upcoming.map(event => <article className="card event-card" key={event.id}><div className="event-date">{new Date(event.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div><strong>{event.gujaratiTitle || event.title}</strong><div className="event-meta">{event.time || 'Time to be announced'}<br />{event.location || 'Society premises'}</div></article>)}</div> : <div className="empty-state">No upcoming programs scheduled.</div>}
        </section>

        <section className="section">
          <div className="section-head"><div><p className="eyebrow">Communication</p><h2>Notices / સૂચનાઓ</h2></div></div>
          {notices.length ? <div className="grid">{notices.map(notice => <article className="card notice" key={notice.id}><strong>{notice.gujaratiTitle || notice.title}</strong><p>{notice.gujaratiContent || notice.content}</p></article>)}</div> : <div className="empty-state">No published notices available.</div>}
        </section>

        <section className="section">
          <div className="section-head"><div><p className="eyebrow">Community</p><h2>Gallery / ફોટો</h2></div><span className="section-subtitle">{photos.length} photos</span></div>
          {photos.length ? <div className="grid gallery-grid">{photos.map(photo => <article className="card gallery-card" key={photo.id}><div className="gallery-thumb"><img src={photo.fileUrl} alt={photo.altText || photo.title || 'Society photo'} /></div><div className="gallery-copy"><strong>{photo.title || photo.albumName || 'Society memory'}</strong>{photo.albumName && <small>{photo.albumName}</small>}</div></article>)}</div> : <div className="empty-state">No gallery photos available.</div>}
        </section>
      </main>
    </div>

    <nav className="mobile-nav resident-mobile-nav" aria-label="Mobile navigation">
      {dashboard?.role === 'OWNER' ? [
        ['Home','/','home'],['Programs','/programs','calendar'],['Notices','/notices','notice'],['Bills','/bills','report'],['Profile','/profile','users']
      ].map(([label,url,icon]) => <a className={pathname === url ? 'active' : ''} href={url} key={label}><UiIcon name={icon as any} size={16}/><span>{label}</span></a>) : [
        ['Home','/','home'],['Programs','/admin/programs','calendar'],['Notices','/admin/notices','notice'],['Reports','/reports','report'],['Profile','/profile','users']
      ].map(([label,url,icon]) => <a className={pathname === url ? 'active' : ''} href={url} key={label}><UiIcon name={icon as any} size={16}/><span>{label}</span></a>)}
    </nav>
  </div>;
}
<style>{`.gallery-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.gallery-card{overflow:hidden;padding:0}.gallery-thumb{aspect-ratio:4/3;background:var(--soft-surface);overflow:hidden}.gallery-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease}.gallery-card:hover .gallery-thumb img{transform:scale(1.03)}.gallery-copy{padding:10px 12px 12px;display:flex;flex-direction:column;gap:3px}.gallery-copy strong{color:var(--maroon);font-size:13px}.gallery-copy small{color:var(--muted);font-size:11px}@media(max-width:1000px){.gallery-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.gallery-grid{grid-template-columns:1fr 1fr}}

.dashboard-shell .topbar{height:70px;padding:0 30px}
.dashboard-shell .layout{min-height:calc(100vh - 70px);grid-template-columns:238px minmax(0,1fr)}
.dashboard-shell .sidebar{top:70px;height:calc(100vh - 70px);padding:18px 12px}
.dashboard-shell .nav-section{padding-top:12px}
.dashboard-shell .nav-item{gap:10px;min-height:42px;padding:9px 11px}
.dashboard-shell .nav-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:#87766d;flex:0 0 28px}
.dashboard-shell .nav-item.active .nav-icon{background:#fff;color:var(--maroon)}
.dashboard-shell .main{max-width:1320px;padding:34px clamp(22px,3.5vw,52px) 56px}
.topbar-right{display:flex;align-items:center;gap:10px}.secure-pill{font-size:10px;color:#e8ddd5;display:inline-flex;align-items:center;gap:6px}.secure-dot{width:6px;height:6px;border-radius:50%;background:#b9d7b8}.brand-mark{overflow:hidden}.brand-mark img{width:100%;height:100%;object-fit:cover}
.resident-welcome{min-height:188px;border-radius:22px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:space-between;gap:30px;padding:34px 40px;color:#fff;background:radial-gradient(circle at 84% 18%,rgba(231,213,168,.24),transparent 28%),linear-gradient(115deg,#42131c,#641d2a 68%,#7b2636);box-shadow:0 18px 45px rgba(66,19,28,.16)}
.resident-welcome:after{content:'';position:absolute;inset:auto -60px -110px auto;width:290px;height:210px;border:1px solid rgba(231,213,168,.22);border-radius:50%;transform:rotate(-18deg)}
.welcome-copy{position:relative;z-index:1}.resident-welcome .eyebrow{color:#e7d5a8!important}.resident-welcome h1{font-family:var(--font-playfair),Georgia,serif;font-size:clamp(29px,3vw,40px);line-height:1.15;margin:0;color:#fff}.welcome-sub{color:#eadfd8;line-height:1.75;font-size:13px;margin:10px 0 0}.welcome-mark{width:112px;height:112px;border:1px solid rgba(231,213,168,.42);border-radius:50%;display:grid;place-items:center;align-content:center;position:relative;z-index:1;flex:0 0 auto;background:rgba(255,255,255,.045)}.welcome-mark span{color:#e7d5a8;font:700 42px var(--font-gujarati),sans-serif;line-height:1}.welcome-mark small{color:#eadfd8;font-size:8px;line-height:1.35;text-align:center;margin-top:4px}
.first-section{margin-top:27px!important}.resident-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.resident-action{min-height:88px;display:flex;align-items:center;gap:12px;padding:15px;border:1px solid var(--line);border-radius:15px;background:#fff;box-shadow:0 7px 22px rgba(53,21,26,.045);color:var(--ink);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.resident-action:hover{transform:translateY(-2px);border-color:var(--gold);box-shadow:0 14px 30px rgba(53,21,26,.09)}.resident-action>svg{margin-left:auto;color:#a18f84;flex:0 0 auto}.resident-action.action-primary{background:var(--maroon);border-color:var(--maroon);color:#fff}.resident-action.action-primary strong{color:#fff}.resident-action.action-primary small,.resident-action.action-primary>svg{color:#eadfd8}.action-icon{width:39px;height:39px;display:grid;place-items:center;border-radius:11px;background:var(--maroon-soft);color:var(--maroon);flex:0 0 39px}.action-primary .action-icon{background:rgba(255,255,255,.13);color:var(--gold-light)}.resident-action strong{display:block;color:var(--maroon);font-size:12px}.resident-action small{display:block;color:var(--muted);font-size:10px;margin-top:3px;line-height:1.4}
.resident-content-grid{display:grid;grid-template-columns:1.12fr .88fr;gap:16px;margin-top:26px}.dashboard-panel{background:#fff;border:1px solid var(--line);border-radius:18px;padding:21px;box-shadow:0 8px 26px rgba(53,21,26,.045);min-width:0}.dashboard-panel .section-head{margin-bottom:15px}.section-link{display:inline-flex;align-items:center;gap:5px;color:var(--maroon);font-size:11px;font-weight:700;white-space:nowrap}.resident-event-list,.resident-notice-list{display:grid;gap:5px}.resident-event,.resident-notice{display:flex;align-items:center;gap:12px;min-height:62px;padding:8px 6px;border-bottom:1px solid #f0e9e2}.resident-event:last-child,.resident-notice:last-child{border-bottom:0}.resident-event>svg,.resident-notice>svg{margin-left:auto;color:#aa9b91;flex:0 0 auto}.event-date-box{width:46px;height:48px;border-radius:10px;background:var(--maroon-soft);color:var(--maroon);display:grid;place-items:center;align-content:center;flex:0 0 46px}.event-date-box strong{font-size:17px;line-height:1}.event-date-box span{font-size:9px;font-weight:800;text-transform:uppercase;margin-top:3px}.resident-event-copy,.resident-notice-copy{min-width:0;display:flex;flex-direction:column;gap:4px}.resident-event-copy strong,.resident-notice-copy strong{color:var(--maroon);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.resident-event-copy span,.resident-notice-copy small{color:var(--muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.notice-dot{width:9px;height:9px;border-radius:50%;background:#d8ccc0;flex:0 0 9px}.notice-dot.important{background:var(--gold);box-shadow:0 0 0 4px #f8f0df}.resident-empty{min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1px dashed #ddd1c6;border-radius:13px;background:#fcfaf7;color:var(--muted);gap:5px}.resident-empty strong{color:var(--maroon);font-size:12px}.resident-empty>span:last-child{font-size:10px}.empty-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:var(--maroon-soft);color:var(--maroon);margin-bottom:5px}.gallery-panel{margin-top:16px}.dashboard-gallery{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.dashboard-gallery-tile{position:relative;aspect-ratio:1;border-radius:11px;overflow:hidden;background:var(--surface-soft)}.dashboard-gallery-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s ease}.dashboard-gallery-tile:hover img{transform:scale(1.05)}.dashboard-gallery-tile span{position:absolute;left:0;right:0;bottom:0;padding:22px 7px 7px;color:#fff;font-size:9px;background:linear-gradient(transparent,rgba(0,0,0,.72));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sidebar-help{margin:10px 4px 12px;padding:13px;border:1px solid #eadfce;border-radius:13px;background:#fffaf2}.sidebar-help-icon{width:27px;height:27px;border-radius:8px;display:grid;place-items:center;background:var(--maroon-soft);color:var(--maroon);margin-bottom:8px}.sidebar-help strong{display:block;color:var(--maroon);font-size:11px}.sidebar-help small{display:block;color:var(--muted);font-size:9px;line-height:1.45;margin-top:3px}.dashboard-loading{min-height:55vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:var(--muted);font-size:12px}.loading-mark{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:var(--maroon-dark);color:var(--gold-light);font:700 22px var(--font-playfair),serif;margin-bottom:8px}
@media(max-width:1100px){.resident-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.resident-content-grid{grid-template-columns:1fr}.dashboard-gallery{grid-template-columns:repeat(3,minmax(0,1fr))}.secure-pill{display:none}}
@media(max-width:900px){.dashboard-shell .topbar{height:68px;padding:0 14px}.dashboard-shell .layout{grid-template-columns:1fr;min-height:calc(100vh - 68px)}.dashboard-shell .sidebar{display:none}.dashboard-shell .main{padding:22px 18px 90px}.resident-welcome{padding:27px 25px;min-height:175px}.welcome-mark{width:90px;height:90px}.welcome-mark span{font-size:33px}.mobile-nav a{display:flex;flex-direction:column;gap:4px}}
@media(max-width:560px){.dashboard-shell .main{padding:17px 13px 86px}.topbar-right .role-badge{font-size:9px;padding:6px 8px}.brand-copy{max-width:185px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brand-copy small{display:none}.resident-welcome{padding:23px 19px;min-height:165px;border-radius:18px}.resident-welcome h1{font-size:27px}.welcome-sub{font-size:11px;line-height:1.6}.welcome-mark{width:74px;height:74px}.welcome-mark small{display:none}.resident-actions{grid-template-columns:1fr 1fr;gap:9px}.resident-action{min-height:82px;padding:11px;gap:8px}.action-icon{width:34px;height:34px;flex-basis:34px}.resident-action strong{font-size:10px}.resident-action small{font-size:9px}.resident-action>svg{display:none}.dashboard-panel{padding:16px;border-radius:15px}.dashboard-gallery{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.section h2{font-size:16px}}
`}</style>
