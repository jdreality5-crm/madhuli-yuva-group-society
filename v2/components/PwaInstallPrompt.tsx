'use client';

import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const dismissedUntil = Number(localStorage.getItem('myg-pwa-dismissed-until') || 0);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
      if (Date.now() > dismissedUntil) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if (isIos && Date.now() > dismissedUntil) setShow(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setShow(false);
      return;
    }
    setShow(false);
  }

  function later() {
    localStorage.setItem('myg-pwa-dismissed-until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setShow(false);
  }

  return <div className="pwa-install-backdrop" role="dialog" aria-modal="true" aria-labelledby="pwa-title">
    <div className="pwa-install-card">
      <div className="pwa-install-icon">MYG</div>
      <p className="eyebrow">Madhuli Yuva Group</p>
      <h2 id="pwa-title">Install the app</h2>
      <p>Get a faster, app-like experience on your phone, tablet or desktop. Your Home Screen shortcut will use the name <strong>Madhuli Yuva Group</strong>.</p>
      {ios && !deferred && <p className="pwa-ios-help">On iPhone/iPad, tap <strong>Share → Add to Home Screen → Add</strong>.</p>}
      <div className="pwa-actions"><button className="btn btn-secondary" onClick={later}>Maybe Later</button><button className="btn btn-primary" onClick={install}>{ios && !deferred ? 'Got it' : 'Install App'}</button></div>
    </div>
  </div>;
}
