'use client';
import { useEffect, useMemo, useState } from 'react';
import './globals.css';

type Role = 'MASTER_ADMIN' | 'ORGANIZER' | 'OWNER';
type Dashboard = { role: Role; society?: { name: string; city?: string | null; state?: string | null }; stats?: { totalIncome: string; totalExpense: string; balance: string; flats: number; events: number }; upcomingEvents: any[]; notices: any[]; photos: any[] };

const money = (p?: string) => p ? `₹ ${(Number(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ 0.00';

const primaryLinks = [
  ['Dashboard', '/'],
  ['Properties', '/admin/properties'],
  ['Flats & Owners', '/admin/flats'],
  ['Programs', '/admin/programs'],
  ['Notices', '#'],
  ['Gallery', '#'],
] as const;

const roleLinks = (role: Role) => role === 'MASTER_ADMIN'
  ? [['Resident Approvals', '/admin/owner-approvals'], ['Sub Admins', '/admin/subadmins'], ['UPI Accounts', '/admin/payment-accounts'], ['Payment Verification', '/admin/payments'], ['Income', '/admin/income'], ['Expenses', '/admin/expenses'], ['Bills', '/admin/bills'], ['Reports', '/reports'], ['Annual Reports', '/annual-reports'], ['Profile', '/profile'], ['Settings', '#']] as const
  : role === 'ORGANIZER'
    ? [['Resident Approvals', '/admin/owner-approvals'], ['Payment Verification', '/admin/payments'], ['Income', '/admin/income'], ['Expenses', '/admin/expenses'], ['Bills', '/admin/bills'], ['Reports', '/reports'], ['Annual Reports', '/annual-reports'], ['Profile', '/profile'], ['Settings', '#']] as const
    : [['Make Payment', '/payments'], ['Profile', '/profile']] as const;

const roleLabel = (role: Role) => role === 'MASTER_ADMIN' ? 'Master Admin' : role === 'ORGANIZER' ? 'Sub Admin / Organizer' : 'Resident';

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(async response => { if (!response.ok) throw Error(); return response.json(); })
      .then(setDashboard)
      .catch(() => setError('Please login to continue'))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  if (loading) return <main className="main"><div className="card empty-state">Loading your society dashboard…</div></main>;
  if (error) return <main className="main"><div className="card" style={{ maxWidth: 560, margin: '10vh auto', textAlign: 'center' }}><div className="brand-mark" style={{ margin: '0 auto 14px' }}>S</div><h1 style={{ color: 'var(--maroon)' }}>Society Administration</h1><p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{error}</p><a className="btn btn-primary" href="/login">Continue to Login</a></div></main>;

  const links = roleLinks(dashboard!.role);
  const upcoming = dashboard?.upcomingEvents ?? [];
  const notices = dashboard?.notices ?? [];
  const photos = dashboard?.photos ?? [];
  const location = [dashboard?.society?.city, dashboard?.society?.state].filter(Boolean).join(', ');
  const mobileLinks = useMemo(() => dashboard?.role === 'OWNER' ? [['Home', '/'], ['Make Payment', '/payments'], ['Profile', '/profile']] : [['Home', '/'], ['Properties', '/admin/properties'], ['Programs', '/admin/programs'], ['Reports', '/reports'], ['Profile', '/profile']], [dashboard?.role]);

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
            <div className="card stat-card"><div className="stat-label">Total Income</div><div className="stat-value">{money(dashboard.stats.totalIncome)}</div><div className="stat-note">Recorded receipts</div></div>
            <div className="card stat-card"><div className="stat-label">Total Expense</div><div className="stat-value">{money(dashboard.stats.totalExpense)}</div><div className="stat-note">Recorded expenditure</div></div>
            <div className="card stat-card"><div className="stat-label">Current Balance</div><div className="stat-value">{money(dashboard.stats.balance)}</div><div className="stat-note">Income less expenses</div></div>
            <div className="card stat-card"><div className="stat-label">Active Flats</div><div className="stat-value">{dashboard.stats.flats}</div><div className="stat-note">Society records</div></div>
          </div>
        </section>}

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
          {photos.length ? <div className="grid gallery-grid">{photos.map(photo => <div className="card gallery-card" key={photo.id}><img src={photo.fileUrl} alt={photo.altText || photo.title || 'Society photo'} /></div>)}</div> : <div className="empty-state">No gallery photos available.</div>}
        </section>
      </main>
    </div>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      {mobileLinks.map(([label, url], index) => <a className={index === 0 ? 'active' : ''} href={url} key={label}>{label}</a>)}
    </nav>
  </div>;
}
