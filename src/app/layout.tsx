import type { Metadata } from 'next';
import '@/styles/globals.css';
import { mono, sans } from '@/lib/fonts';
import { SITE } from '@/lib/site';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ThemeScript } from '@/components/layout/ThemeScript';
import { ToastProvider } from '@/components/ui/ToastProvider';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — in-browser JSON, JSONL, XML & Markdown tools`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.tagline,
  applicationName: SITE.name,
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} — in-browser JSON, JSONL, XML & Markdown tools`,
    description: SITE.tagline,
    url: SITE.url,
    locale: 'en_US',
    images: [{ url: '/og.svg', width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — in-browser JSON, JSONL, XML & Markdown tools`,
    description: SITE.tagline,
    images: ['/og.svg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-screen flex-col">
        <ToastProvider>
          <Header />
          <main className="mx-auto w-full max-w-app flex-1 px-4 py-8 sm:px-6">{children}</main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
