import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: `How ${SITE.name} works: a fully client-side, privacy-first developer utility. No servers, no tracking.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <article className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase tracking-wide text-muted">About</p>
        <h1 className="font-mono text-title font-600 text-ink">{SITE.name}</h1>
      </header>

      <section className="flex flex-col gap-3 text-body text-muted">
        <p>
          <span className="text-ink">{SITE.name}</span> is a fast, privacy-first collection of
          developer utilities for validating, formatting, and previewing JSON, XML, and Markdown.
        </p>
        <p className="text-ink">{SITE.privacyPromise}</p>
        <p>
          Every tool runs entirely in your browser. There is no backend and no analytics that
          captures your content — the data you paste is never uploaded, logged, or stored on a
          server. Parsing happens on-device, using Web Workers so large inputs never freeze the
          interface.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-section font-600 text-ink">Built with</h2>
        <ul className="flex flex-col gap-1 text-body text-muted">
          <li>Next.js (static export) + TypeScript</li>
          <li>CodeMirror 6 for editing</li>
          <li>Client-side parsers for JSON, XML, and Markdown</li>
        </ul>
      </section>
    </article>
  );
}
