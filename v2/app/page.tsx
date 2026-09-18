'use client';
import { UiIcon } from '@/components/UiIcon';
import { useEffect, useMemo, useState } from 'react';

type Role = 'MASTER_ADMIN' | 'ORGANIZER' | 'OWNER';
type Dashboard = { role: Role; permissions?: string[]; society?: { name: string; city?: string | null; state?: string | null }; stats?: { totalIncome: string; totalExpense: string; balance: string; flats: number; events: number }; upcomingEvents: any[]; notices: any[]; photos: any[] };

const money = (p?: string) => p ? `₹ ${(Number(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ 0.00';

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
  const notices = dashboard?.notices ?? [];
  const photos = dashboard?.photos ?? [];
  const location = [dashboard?.society?.city, dashboard?.society?.state].filter(Boolean).join(', ');
  const mobileLinks = useMemo(() => dashboard?.role === 'OWNER' ? [['Home', '/'], ['Payment', '/payments'], ['Profile', '/profile']] : [['Home', '/'], ['Programs', '/programs'], ['Notices', '/notices'], ['Bills', '/bills'], ['Gallery', '/gallery'], ['Profile', '/profile']], [dashboard?.role]);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">S</div>
        <div className="brand-copy">{dashboard?.society?.name || 'Society Administration'}<small>સોસાયટી ફંક્શન મેનેજમેન્ટ</small></div>
      </div>
      <span className="role-badge"><span className="role-dot" />{roleLabel(dashboard!.role)}</span>
    </header>

    <div className="layout">
      <aside className="sidebar">
        <div className="nav-section">Workspace</div>
        {primaryLinks.map(([label, url], index) => <a className={'nav-item ' + (index === 0 ? 'active' : '')} href={url} key={label}>{label}</a>)}
        {dashboard?.role !== 'OWNER' && permissionLinks.filter(([, permission]) => dashboard?.role === 'MASTER_ADMIN' || dashboard?.permissions?.includes(permission)).map(([label, , url]) => <a className="nav-item" href={url} key={label}>{label}</a>)}
        <div className="nav-section">Administration</div>
        {links.map(([label, url]) => <a className="nav-item" href={url} key={label}>{label}</a>)}
        <div className="nav-spacer" />
        <button className="nav-item logout-btn" onClick={logout} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Logout'}</button>
      </aside>

      <main className="main">
        <div className="page-title">
          <div><p className="eyebrow">Society Administration</p><h1>{dashboard?.role === 'MASTER_ADMIN' ? 'Master Admin Dashboard' : dashboard?.role === 'ORGANIZER' ? 'Organizer Dashboard' : 'મારું સોસાયટી ડેશબોર્ડ'}</h1><p>{location || 'Society overview and daily operations'}</p></div>
          <div className="page-meta">{roleLabel(dashboard!.role)}</div>
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
            <div className="card stat-card"><div className="stat-icon" aria-hidden="true><UiIcon name="report" size={18}/></div><div className="stat-label">Total Expense</div><div className="stat-value">{money(dashboard.stats.totalExpense)}</div><div className="stat-note">Recorded expenditure</div></div>
            <div className="card stat-card"><div className="stat-icon" aria-hidden="true><UiIcon name="check" size={18}/></div><div className="stat-label">Current Balance</div><div className="stat-value">{money(dashboard.stats.balance)}</div><div className="stat-note">Income less expenses</div></div>
            <div className="card stat-card"><div className="stat-icon" aria-hidden="true><UiIcon name="home" size={18}/></div><div className="stat-label">Active Flats</div><div className="stat-value">{dashboard.stats.flats}</div><div className="stat-note">Society records</div></div>
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

    <nav className="mobile-nav" aria-label="Mobile navigation">
      {mobileLinks.map(([label, url], index) => <a className={index === 0 ? 'active' : ''} href={url} key={label}>{label}</a>)}
    </nav>
  </div>;
}\n<style>{`.gallery-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.gallery-card{overflow:hidden;padding:0}.gallery-thumb{aspect-ratio:4/3;background:var(--soft-surface);overflow:hidden}.gallery-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease}.gallery-card:hover .gallery-thumb img{transform:scale(1.03)}.gallery-copy{padding:10px 12px 12px;display:flex;flex-direction:column;gap:3px}.gallery-copy strong{color:var(--maroon);font-size:13px}.gallery-copy small{color:var(--muted);font-size:11px}@media(max-width:1000px){.gallery-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.gallery-grid{grid-template-columns:1fr 1fr}}`}</style>
