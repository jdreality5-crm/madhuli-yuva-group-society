'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ProfileLogoutGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (pathname !== '/profile' && pathname !== '/profile/') return null;

  async function logout() {
    if (busy || !window.confirm('Are you sure you want to logout?')) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <section aria-label="Account actions" style={{ position: 'fixed', left: 16, right: 16, bottom: 92, zIndex: 45, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', border: '1px solid #eadfd5', borderRadius: 16, background: 'rgba(255,253,249,.97)', boxShadow: '0 10px 30px rgba(53,21,26,.14)' }}>
      <div>
        <strong style={{ display: 'block', color: '#641d2a', fontSize: 13 }}>Account actions</strong>
        <span style={{ display: 'block', color: '#756b64', fontSize: 11, marginTop: 3 }}>Securely end your current session.</span>
      </div>
      <button type="button" onClick={logout} disabled={busy} style={{ border: 0, borderRadius: 10, padding: '11px 16px', background: '#74182f', color: '#fff', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', opacity: busy ? .65 : 1 }}>
        {busy ? 'Logging out…' : 'Logout'}
      </button>
    </section>
  );
}
