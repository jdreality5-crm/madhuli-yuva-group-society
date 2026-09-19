'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const PERMISSION_ROUTES: Array<[string, string]> = [
  ['/admin/programs', 'EVENTS'], ['/admin/notices', 'NOTICES'], ['/admin/gallery', 'GALLERY'],
  ['/admin/bills', 'BILLS'], ['/admin/payments', 'PAYMENTS'], ['/admin/income', 'INCOME'],
  ['/admin/expenses', 'EXPENSES'],
];
const MASTER_ONLY = ['/admin/owner-approvals', '/admin/payment-accounts', '/admin/subadmins', '/admin/role-change'];

export default function AdminPermissionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const required = useMemo(() => PERMISSION_ROUTES.find(([route]) => pathname === route || pathname.startsWith(route + '/'))?.[1] ?? null, [pathname]);
  const masterOnly = useMemo(() => MASTER_ONLY.some(route => pathname === route || pathname.startsWith(route + '/')), [pathname]);

  useEffect(() => {
    let active = true;
    setAllowed(null);
    fetch('/api/session', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) throw new Error('UNAUTHORIZED');
        const isMaster = data.role === 'MASTER_ADMIN';
        const isOrganizer = data.role === 'ORGANIZER';
        const ok = isMaster || (isOrganizer && !masterOnly && (required === null || (Array.isArray(data.permissions) && data.permissions.includes(required))));
        if (active) {
          if (!ok) router.replace('/');
          else setAllowed(true);
        }
      })
      .catch(() => { if (active) router.replace('/login'); });
    return () => { active = false; };
  }, [pathname, required, masterOnly, router]);

  if (allowed !== true) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>Checking access…</div>;
  return <>{children}</>;
}