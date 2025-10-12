import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Player } from '@/components/Player';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'th3scr1b3 — v2',
    template: '%s — th3scr1b3',
  },
  applicationName: 'th3scr1b3',
  description: 'Modern music hub with persistent player and Audius integration',
  openGraph: {
    title: 'th3scr1b3 — v2',
    siteName: 'th3scr1b3',
    description: 'Modern music hub with persistent player and Audius integration',
    type: 'website',
    images: ['/icon.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'th3scr1b3 — v2',
    description: 'Modern music hub with persistent player and Audius integration',
    images: ['/icon.svg'],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f0f12',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-black/40">
            <div className="mx-auto w-full max-w-6xl px-4 py-3 flex items-center justify-between">
              <div className="font-semibold tracking-wide flex items-center gap-3">
                <span>th3scr1b3</span>
                <span className="text-xs px-2 py-1 rounded-md border border-white/10 bg-white/5">Audius</span>
              </div>
              <nav className="text-sm text-white/70 flex items-center gap-4">
                <a className="hover:text-white" href="/">Library</a>
                <a className="hover:text-white" href="/collections">Collections</a>
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            {children}
          </main>
        </div>

        {/* Persistent floating player */}
        <Player />
      </body>
    </html>
  );
}
