'use client';

import { useEffect, useState } from 'react';

 type SessionInfo = { role?: 'MASTER_ADMIN' | 'ORGANIZER' | 'OWNER'; permissions?: string[] };

export default function FinanceHome() {
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : {})
      .then(setSession)
      .catch(() => setSession({}));
  }, []);

  const isMaster = session?.role === 'MASTER_ADMIN';
  const permissions = new Set(session?.permissions || []);
  const can = (permission: string) => isMaster || permissions.has('*') || permissions.has(permission);
  const sections = [
    { label: 'Income / આવક', description: 'Record and manage society income.', href: '/admin/income', permission: 'INCOME' },
    { label: 'Expenses / ખર્ચ', description: 'Record and manage society expenses.', href: '/admin/expenses', permission: 'EXPENSES' },
  ].filter((section) => can(section.permission));

  return <div className="main">
    <div className="page-title">
      <div><p className="eyebrow">FINANCE</p><h1>Finance / નાણાં</h1><p>Income અને Expenses બંને એક જ જગ્યાએ મેનેજ કરો.</p></div>
    </div>
    <div className="finance-section-grid">
      {sections.map((section) => <a className="card finance-section-card" href={section.href} key={section.href}>
        <span className="eyebrow">FINANCE</span>
        <h2>{section.label}</h2>
        <p>{section.description}</p>
        <strong>Open section →</strong>
      </a>)}
      {!sections.length && <div className="card"><p>You do not have Finance permissions.</p></div>}
    </div>
    <style>{`.finance-section-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.finance-section-card{display:block;text-decoration:none;border-top:3px solid var(--gold);transition:transform .18s ease}.finance-section-card:hover{transform:translateY(-2px)}.finance-section-card h2{color:var(--maroon);margin:8px 0}.finance-section-card p{color:var(--muted);margin:0 0 18px}.finance-section-card strong{color:var(--maroon)}@media(max-width:650px){.finance-section-grid{grid-template-columns:1fr}}`}</style>
  </div>;
}
