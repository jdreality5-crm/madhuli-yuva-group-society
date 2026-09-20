'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { UiIcon } from '@/components/UiIcon';

const items = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Properties', href: '/properties', icon: 'property' },
  { label: 'Programs', href: '/programs', icon: 'calendar' },
  { label: 'Bills', href: '/bills', icon: 'report' },
  { label: 'Profile', href: '/profile', icon: 'users' },
] as const;

const publicPaths = ['/login', '/signup', '/forgot-password', '/verify-email'];

export default function MobileAppShellFix() {
  const pathname = usePathname() || '/';
  const router = useRouter();

  useEffect(() => {
    for (const item of items) router.prefetch(item.href);

    // The legacy navigation and DOM text observer caused duplicate/unstable
    // mobile controls. Keep one predictable five-item navigation instead.
    document.querySelectorAll<HTMLElement>('.mobile-nav').forEach((node) => {
      node.style.display = 'none';
    });
  }, [router]);

  if (publicPaths.some((path) => pathname.startsWith(path))) return null;

  return (
    <nav className="mobile-app-nav" aria-label="Mobile application navigation">
      {items.map((item) => (
        <a key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
          <UiIcon name={item.icon as any} size={20} />
          <small>{item.label}</small>
        </a>
      ))}
      <style jsx>{`
        .mobile-app-nav { display:none; }
        @media (max-width:900px) {
          .mobile-app-nav { position:fixed; left:0; right:0; bottom:0; z-index:100; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); padding:8px 8px calc(8px + env(safe-area-inset-bottom)); background:rgba(255,255,255,.98); border-top:1px solid #eadfd5; box-shadow:0 -8px 24px rgba(53,21,26,.08); }
          .mobile-app-nav a { min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-height:54px; border-radius:12px; color:#756b64; text-decoration:none; }
          .mobile-app-nav small { font-size:10px; line-height:1; }
          .mobile-app-nav a.active { background:#f8e9ed; color:#74182f; font-weight:800; }
          :global(body) { padding-bottom:calc(78px + env(safe-area-inset-bottom)); }
          :global(.profile-actions) { display:none !important; }
          :global(.profile-loading) { display:none !important; }
          :global(.profile-identity) { background:linear-gradient(115deg,#42131c,#641d2a 65%,#7a2938); color:#fff; padding-top:18px; border-radius:0 0 18px 18px; }
          :global(.profile-identity .identity-copy h2), :global(.profile-identity .identity-copy p) { color:#fff !important; }
          :global(.profile-identity .identity-badge) { border-color:rgba(255,255,255,.22); }
          :global(.brand-mark img) { display:none !important; }
          :global(.brand-mark) { font-size:0 !important; }
          :global(.brand-mark)::after { content:'M'; font-size:24px; font-weight:800; }
          :global(.brand-copy) { font-size:0 !important; }
          :global(.brand-copy)::before { content:'Madhuli Yuva Group'; font-size:16px; }
        }
      `}</style>
    </nav>
  );
}
