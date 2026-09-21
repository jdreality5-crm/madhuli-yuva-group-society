'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const NAME = 'Madhuli Yuva Group';
const SUBTITLE = 'સોસાયટી ફંક્શન મેનેજમેન્ટ';

export default function DashboardBrandGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') return;
    let disposed = false;
    let observer: MutationObserver | null = null;

    const apply = () => {
      if (disposed) return;
      const shell = document.querySelector<HTMLElement>('.dashboard-shell');
      if (!shell) return;

      const mark = shell.querySelector<HTMLElement>('.brand-mark');
      if (mark) {
        mark.textContent = 'M';
        mark.setAttribute('aria-label', NAME);
      }

      const copy = shell.querySelector<HTMLElement>('.brand-copy');
      if (copy && copy.dataset.madhuliBrand !== 'true') {
        copy.textContent = '';
        const name = document.createElement('span');
        name.textContent = NAME;
        const subtitle = document.createElement('small');
        subtitle.textContent = SUBTITLE;
        copy.append(name, subtitle);
        copy.dataset.madhuliBrand = 'true';
      }

      // Remove the unwanted middle admin/control card from the dashboard.
      shell.querySelector<HTMLElement>('.control-card')?.style.setProperty('display', 'none', 'important');
    };

    const runSafely = () => {
      if (disposed || !observer) return;
      observer.disconnect();
      apply();
      if (!disposed) observer.observe(document.body, { childList: true, subtree: true });
    };

    observer = new MutationObserver(runSafely);
    observer.observe(document.body, { childList: true, subtree: true });
    runSafely();

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
