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

      const legacyMobileNav = shell.querySelector<HTMLElement>(':scope > .mobile-nav');
      if (legacyMobileNav) {
        legacyMobileNav.style.setProperty('display', 'none', 'important');
      }

      const brandMark = shell.querySelector<HTMLElement>('.brand-mark');
      const brandCopy = shell.querySelector<HTMLElement>('.brand-copy');
      if (brandMark && brandMark.textContent !== 'M') {
        brandMark.textContent = 'M';
      }
      if (brandCopy && brandCopy.dataset.presentationFixed !== 'true') {
        brandCopy.textContent = '';
        const name = document.createTextNode(BRAND_NAME);
        const subtitle = document.createElement('small');
        subtitle.textContent = BRAND_SUBTITLE;
        brandCopy.append(name, subtitle);
        brandCopy.dataset.presentationFixed = 'true';
      }

      const controlCard = shell.querySelector<HTMLElement>('.control-card');
      if (!controlCard) return;

      controlCard.querySelector<HTMLElement>('.badge')?.remove();
      controlCard.querySelector<HTMLElement>('.admin-description')?.remove();
      controlCard.querySelector<HTMLAnchorElement>('.btn.btn-primary')?.remove();

      const heading = controlCard.querySelector<HTMLElement>('.section-head h2');
      if (heading) {
        const nextHeading = profileName ? `Welcome, ${profileName}` : 'Society administration';
        if (heading.textContent !== nextHeading) {
          heading.textContent = nextHeading;
        }
      }
    };

    let observer: MutationObserver;
    const applySafely = () => {
      if (cancelled) return;
      observer.disconnect();
      apply();
      if (!cancelled) {
        observer.observe(document.body, { childList: true, subtree: true });
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
        applySafely();
      }
    };

    observer = new MutationObserver(applySafely);
    observer.observe(document.body, { childList: true, subtree: true });
    applySafely();
    void loadProfileName();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
