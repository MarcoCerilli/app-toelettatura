import type { Metadata, Viewport } from 'next';
import './globals.css'; // Global styles
import { PwaRegister } from '@/components/PwaRegister';

export const viewport: Viewport = {
  themeColor: '#451a03',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Qua La Zampa Terracina — Prodotti per Animali & Toelettatura',
  description: 'Qua La Zampa in Via Vittorio Bachelet 22, Terracina (LT): prodotti per animali, linea naturale, assistente automatico h24 e servizi di toelettatura.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Qua La Zampa',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    title: 'Qua La Zampa Terracina — Prodotti per Animali & Toelettatura',
    description: 'Via Vittorio Bachelet 22, Terracina (LT) · Prodotti per animali, linea naturale e servizi di toelettatura.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Qua La Zampa Terracina — Prodotti per Animali & Toelettatura',
    description: 'Via Vittorio Bachelet 22, Terracina (LT) · Prodotti per animali, linea naturale e servizi di toelettatura.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="it" className="light">
      <body className="bg-slate-50 text-slate-800 antialiased font-sans min-h-screen" suppressHydrationWarning>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
