'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const BRAND_NAME = 'Madhuli Yuva Group';
const BRAND_SUBTITLE = 'સોસાયટી ફંક્શન મેનેજમેન્ટ';

export default function DashboardPresentationFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') return;

    let cancelled = false;
    let profileName = '';

    const apply = () => {
      if (cancelled) return;

      const shell = document.querySelector<HTMLElement>('.dashboard-shell');
      if (!shell) return;

      // MobileAppShellFix owns the responsive navigation. Hide the dashboard's
      // legacy internal nav to prevent duplicate/role-mismatched footers.
      const legacyMobileNav = shell.querySelector<HTMLElement>(':scope > .mobile-nav');
      if (legacyMobileNav) {
        legacyMobileNav.style.setProperty('display', 'none', 'important');
      }

      const brandMark = shell.querySelector<HTMLElement>('.brand-mark');
      const brandCopy = shell.querySelector<HTMLElement>('.brand-copy');
      if (brandMark) brandMark.textContent = 'M';
      if (brandCopy) {
        brandCopy.textContent = '';
        const name = document.createTextNode(BRAND_NAME);
        const subtitle = document.createElement('small');
        subtitle.textContent = BRAND_SUBTITLE;
        brandCopy.append(name, subtitle);
      }

      const controlCard = shell.querySelector<HTMLElement>('.control-card');
      if (!controlCard) return;

      controlCard.querySelector<HTMLElement>('.badge')?.remove();
      controlCard.querySelector<HTMLElement>('.admin-description')?.remove();
      controlCard.querySelector<HTMLAnchorElement>('.btn.btn-primary')?.remove();

      const heading = controlCard.querySelector<HTMLElement>('.section-head h2');
      if (heading) {
        heading.textContent = profileName ? `Welcome, ${profileName}` : 'Society administration';
      }
    };

    const loadProfileName = async () => {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data?.profile?.name === 'string' && data.profile.name.trim()) {
          profileName = data.profile.name.trim();
        }
      } catch {
        // The dashboard remains usable even when profile data is unavailable.
      } finally {
        apply();
      }
    };

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    apply();
    void loadProfileName();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
