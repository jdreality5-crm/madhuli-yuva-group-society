'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { UiIcon } from '@/components/UiIcon';

const items = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Properties', href: '/properties', icon: 'property' },
  { label: 'Programs', href: '/programs', icon: 'calendar' },
  { label: 'Bills', href: '/bills', icon: 'report' },
  { label: 'Profile', href: '/profile', icon: 'users' },
] as const;

const publicPaths = ['/login', '/signup', '/forgot-password', '/verify-email'];

function normalizeRenderedText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);

  for (const node of nodes) {
    if (node.nodeValue?.includes('Saranga Apartment')) {
      node.nodeValue = node.nodeValue.replaceAll('Saranga Apartment', 'Sarang Apartment');
    }
  }

  const brandCopy = document.querySelector<HTMLElement>('.brand-copy');
  if (brandCopy) brandCopy.childNodes[0].textContent = 'Madhuli Yuva Group';

  const brandMark = document.querySelector<HTMLElement>('.brand-mark');
  if (brandMark) {
    const image = brandMark.querySelector('img');
    if (image) image.style.display = 'none';
    if (!brandMark.textContent?.trim() || image) brandMark.textContent = 'M';
  }
}

function pinExistingNavigation() {
  const existing = document.querySelector<HTMLElement>('.mobile-nav');
  if (!existing) return false;

  existing.style.position = 'fixed';
  existing.style.left = '0';
  existing.style.right = '0';
  existing.style.bottom = '0';
  existing.style.zIndex = '50';
  existing.style.display = 'grid';
  return true;
}

export default function MobileAppShellFix() {
  const pathname = usePathname() || '/';
  const [mounted, setMounted] = useState(false);
  const [existingNavigation, setExistingNavigation] = useState(false);

  useEffect(() => {
    setMounted(true);
    normalizeRenderedText();
    setExistingNavigation(pinExistingNavigation());
  }, [pathname]);

  useEffect(() => {
    if (!mounted) return;
    const frame = window.requestAnimationFrame(() => {
      normalizeRenderedText();
      setExistingNavigation(pinExistingNavigation());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mounted, pathname]);

  if (!mounted || existingNavigation || publicPaths.some((path) => pathname.startsWith(path))) return null;

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
          .mobile-app-nav { position:fixed; left:0; right:0; bottom:0; z-index:55; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); padding:8px 8px calc(8px + env(safe-area-inset-bottom)); background:rgba(255,255,255,.98); border-top:1px solid #eadfd5; box-shadow:0 -8px 24px rgba(53,21,26,.08); }
          .mobile-app-nav a { min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-height:54px; border-radius:12px; color:#756b64; text-decoration:none; }
          .mobile-app-nav small { font-size:10px; line-height:1; }
          .mobile-app-nav a.active { background:#f8e9ed; color:#74182f; font-weight:800; }
        }
      `}</style>
    </nav>
  );
}
