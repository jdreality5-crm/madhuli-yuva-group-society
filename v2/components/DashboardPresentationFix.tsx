'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const BRAND_NAME = 'Madhuli Yuva Group';

export default function DashboardPresentationFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') return;

    let cancelled = false;
    let profileName = '';

    const apply = () => {
      if (cancelled) return;

      const brandMark = document.querySelector<HTMLElement>('.dashboard-shell .brand-mark');
      const brandCopy = document.querySelector<HTMLElement>('.dashboard-shell .brand-copy');
      if (brandMark) brandMark.textContent = 'M';
      if (brandCopy) {
        brandCopy.childNodes[0].textContent = BRAND_NAME;
        const subtitle = brandCopy.querySelector('small');
        if (subtitle) subtitle.textContent = 'સોસાયટી ફંક્શન મેનેજમેન્ટ';
      }

      const controlCard = document.querySelector<HTMLElement>('.dashboard-shell .control-card');
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
