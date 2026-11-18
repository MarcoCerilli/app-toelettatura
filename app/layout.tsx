import type { Metadata, Viewport } from 'next';
import './globals.css'; // Global styles
import { PwaRegister } from '@/components/PwaRegister';

export const viewport: Viewport = {
  themeColor: '#451a03',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'App Toelettatura — Prenotazioni Online & Agenda Salone',
  description: 'Demo completa per saloni di toelettatura: pagina di prenotazione lato cliente h24, agenda per postazioni (Vasca, Tosatura, Finishing) e richiami automatici WhatsApp.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Casa Manto',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    title: 'App Toelettatura — Prenotazioni Online & Agenda Salone',
    description: 'Prenotazioni online per taglia e manto, gestione postazioni e richiami WhatsApp a 6-8 settimane per saloni di toelettatura.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'App Toelettatura — Prenotazioni Online & Agenda Salone',
    description: 'Prenotazioni online per taglia e manto, gestione postazioni e richiami WhatsApp a 6-8 settimane per saloni di toelettatura.',
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
