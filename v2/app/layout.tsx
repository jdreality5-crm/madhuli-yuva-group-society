import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Gujarati, Playfair_Display } from 'next/font/google';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import MobileAppShellFix from '@/components/MobileAppShellFix';
import ProfileLogoutGate from '@/components/ProfileLogoutGate';
import LoadingExperienceGuard from '@/components/LoadingExperienceGuard';
import DashboardBrandGuard from '@/components/DashboardBrandGuard';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const gujarati = Noto_Sans_Gujarati({ subsets: ['gujarati'], variable: '--font-gujarati', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });

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
  return <html lang="gu" className={inter.variable + ' ' + gujarati.variable + ' ' + playfair.variable}><body>{children}<ProfileLogoutGate /><LoadingExperienceGuard /><DashboardBrandGuard /><MobileAppShellFix /><PwaInstallPrompt /></body></html>;
}
