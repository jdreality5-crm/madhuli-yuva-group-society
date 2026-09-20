'use client';

import React from 'react';

export default class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Dashboard could not be rendered.',
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Dashboard render failure:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main style={{ minHeight: '70vh', padding: '32px 20px', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <section style={{ maxWidth: 420, border: '1px solid #eadfd5', borderRadius: 18, padding: 24, background: '#fffdf9' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ color: '#641d2a', fontSize: 22, margin: '0 0 10px' }}>Dashboard could not load</h1>
          <p style={{ color: '#756b64', fontSize: 14, lineHeight: 1.6, margin: '0 0 18px' }}>
            Please try opening the dashboard again. If the issue continues, the technical error is shown below.
          </p>
          <code style={{ display: 'block', padding: 10, borderRadius: 10, background: '#f8f0eb', color: '#641d2a', fontSize: 11, overflowWrap: 'anywhere' }}>
            {this.state.message}
          </code>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 18, border: 0, borderRadius: 10, padding: '12px 18px', background: '#74182f', color: '#fff', fontWeight: 700 }}>
            Reload dashboard
          </button>
        </section>
      </main>
    );
  }
}
