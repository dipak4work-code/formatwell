import { JetBrains_Mono, IBM_Plex_Sans } from 'next/font/google';

/**
 * Fonts are self-hosted at build time by next/font (no runtime request to Google),
 * which keeps the "your data never leaves your device" promise intact.
 */
export const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

export const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600'],
});
