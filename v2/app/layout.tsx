import type { Metadata, Viewport } from 'next';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import './globals.css';

export const metadata: Metadata = {
  title: 'Madhuli Yuva Group',
  description: 'Madhuli Yuva Group Society Management System',
  applicationName: 'Madhuli Yuva Group',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#42131c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="gu"><body>{children}<PwaInstallPrompt /></body></html>;
}
