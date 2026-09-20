'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { UiIcon } from '@/components/UiIcon';

type Role = 'MASTER_ADMIN' | 'ORGANIZER' | 'OWNER';
type SessionInfo = { authenticated: boolean; role?: Role; permissions?: string[] };
type NavItem = { label: string; href: string; icon: string };

const residentItems: NavItem[] = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Properties', href: '/properties', icon: 'property' },
  { label: 'Programs', href: '/programs', icon: 'calendar' },
  { label: 'Bills', href: '/bills', icon: 'report' },
  { label: 'Profile', href: '/profile', icon: 'users' },
];

const masterItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'home' },
  { label: 'Properties', href: '/admin/properties', icon: 'property' },
  { label: 'Programs', href: '/admin/programs', icon: 'calendar' },
  { label: 'Finance', href: '/admin/income', icon: 'report' },
  { label: 'Sub Admins', href: '/admin/subadmins', icon: 'users' },
];

const moreItems = [
  { label: 'Flats & Owners', href: '/admin/flats', permission: 'FLATS' },
  { label: 'Income', href: '/admin/income', permission: 'INCOME' },
  { label: 'Expenses', href: '/admin/expenses', permission: 'EXPENSES' },
  { label: 'Notices', href: '/admin/notices', permission: 'NOTICES' },
  { label: 'Payments', href: '/admin/payments', permission: 'PAYMENTS' },
  { label: 'Gallery', href: '/admin/gallery', permission: 'GALLERY' },
  { label: 'Reports', href: '/annual-reports', permission: 'REPORTS' },
  { label: 'Owner Approvals', href: '/admin/owner-approvals', permission: 'OWNER_APPROVALS' },
  { label: 'Payment Accounts', href: '/admin/payment-accounts', permission: 'PAYMENT_ACCOUNTS' },
] as const;

const publicPaths = ['/login', '/signup', '/forgot-password', '/verify-email', '/resend-verification'];

export default function MobileAppShellFix() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : { authenticated: false })
      .then((data: SessionInfo) => { if (active) setSession(data); })
      .catch(() => { if (active) setSession({ authenticated: false }); });
    return () => { active = false; };
  }, [pathname]);

  const isMaster = session?.role === 'MASTER_ADMIN';
  const items = isMaster ? masterItems : residentItems;

  const visibleMoreItems = useMemo(() => {
    if (session?.role === 'MASTER_ADMIN') return moreItems;
    if (session?.role !== 'ORGANIZER') return [];
    const permissions = new Set(session.permissions || []);
    return moreItems.filter((item) => permissions.has(item.permission) || permissions.has('*'));
  }, [session]);

  useEffect(() => {
    for (const item of items) router.prefetch(item.href);
    for (const item of visibleMoreItems) router.prefetch(item.href);

    const hideLegacyNavigation = () => {
      document.querySelectorAll<HTMLElement>('.mobile-nav').forEach((node) => {
        node.style.setProperty('display', 'none', 'important');
      });
      document.querySelectorAll<HTMLElement>('body *').forEach((node) => {
        if (node.classList.contains('mobile-app-nav') || node.classList.contains('mobile-more-menu')) return;
        const text = (node.textContent || '').trim();
        const controls = node.querySelectorAll('a,button').length;
        if (controls >= 4 && text.includes('Dashboard') && text.includes('Properties')) {
          node.style.setProperty('display', 'none', 'important');
        }
      });
    };

    hideLegacyNavigation();
    const observer = new MutationObserver(hideLegacyNavigation);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [items, router, visibleMoreItems]);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  if (publicPaths.some((path) => pathname.startsWith(path))) return null;

  return (
    <>
      {moreOpen && <button type="button" className="mobile-more-backdrop" aria-label="Close more menu" onClick={() => setMoreOpen(false)} />}
      <nav className="mobile-app-nav" aria-label="Mobile application navigation">
        {items.map((item) => (
          <a key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''} onClick={(event) => { if (pathname === item.href) event.preventDefault(); }}>
            <UiIcon name={item.icon as any} size={20} />
            <small>{item.label}</small>
          </a>
        ))}
        {visibleMoreItems.length > 0 && <button type="button" className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen} aria-controls="mobile-more-menu">
          <UiIcon name="more" size={20} />
          <small>More</small>
        </button>}
      </nav>
      {moreOpen && visibleMoreItems.length > 0 && <section id="mobile-more-menu" className="mobile-more-menu" aria-label="More administration sections">
        <div className="mobile-more-heading"><strong>{isMaster ? 'Master Admin sections' : 'More sections'}</strong><button type="button" onClick={() => setMoreOpen(false)} aria-label="Close more menu"><UiIcon name="close" size={18} /></button></div>
        <div className="mobile-more-grid">{visibleMoreItems.map((item) => <a key={item.href} href={item.href}>{item.label}<span aria-hidden="true">›</span></a>)}</div>
      </section>}
      <style jsx>{`
        .mobile-app-nav,.mobile-more-backdrop,.mobile-more-menu { display:none; }
        @media (max-width:900px) {
          :global(.mobile-nav) { display:none !important; }
          .mobile-app-nav { position:fixed; left:0; right:0; bottom:0; z-index:100; display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:3px; padding:8px 6px calc(8px + env(safe-area-inset-bottom)); background:rgba(255,255,255,.98); border-top:1px solid #eadfd5; box-shadow:0 -8px 24px rgba(53,21,26,.08); }
          .mobile-app-nav a,.mobile-app-nav button { min-width:0; border:0; background:transparent; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-height:54px; border-radius:12px; color:#756b64; text-decoration:none; font:inherit; cursor:pointer; }
          .mobile-app-nav small { font-size:10px; line-height:1; text-align:center; }
          .mobile-app-nav a.active,.mobile-app-nav button.active { background:#f8e9ed; color:#74182f; font-weight:800; }
          .mobile-more-backdrop { display:block; position:fixed; inset:0; z-index:101; border:0; background:rgba(34,18,20,.24); }
          .mobile-more-menu { display:block; position:fixed; left:12px; right:12px; bottom:calc(78px + env(safe-area-inset-bottom)); z-index:102; background:#fffdf9; border:1px solid #eadfd5; border-radius:20px; box-shadow:0 18px 55px rgba(53,21,26,.2); padding:16px; }
          .mobile-more-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; color:#641d2a; }
          .mobile-more-heading button { border:0; background:transparent; color:#641d2a; cursor:pointer; }
          .mobile-more-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
          .mobile-more-grid a { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px; border:1px solid #eadfd5; border-radius:12px; color:#3d3030; text-decoration:none; font-size:13px; font-weight:650; background:#fff; }
          :global(body) { padding-bottom:calc(78px + env(safe-area-inset-bottom)); }
          :global(.profile-actions),:global(.profile-loading) { display:none !important; }
          :global(.profile-identity) { background:linear-gradient(115deg,#42131c,#641d2a 65%,#7a2938); color:#fff; padding-top:18px; border-radius:0 0 18px 18px; }
          :global(.profile-identity .identity-copy h2),:global(.profile-identity .identity-copy p) { color:#fff !important; }
          :global(.profile-identity .identity-badge) { border-color:rgba(255,255,255,.22); }
          :global(.brand-mark img) { display:none !important; }
          :global(.brand-mark) { font-size:0 !important; }
          :global(.brand-mark)::after { content:'M'; font-size:24px; font-weight:800; }
          :global(.brand-copy) { font-size:0 !important; }
          :global(.brand-copy)::before { content:'Madhuli Yuva Group'; font-size:16px; }
        }
        @media (max-width:520px) { .mobile-app-nav { grid-template-columns:repeat(6,minmax(0,1fr)); padding-left:3px; padding-right:3px; } .mobile-app-nav small { font-size:9px; } }
      `}</style>
    </>
  );
}
