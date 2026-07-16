import type { Metadata } from 'next';
import Link from 'next/link';
import { JSON_ERROR_GUIDES } from '@/lib/guides/jsonErrors';

export const metadata: Metadata = {
  title: 'JSON error guides — every JSON.parse error explained',
  description:
    'Plain-language explanations of every common JSON.parse error — what each one means, what causes it, and how to fix it, with runnable examples.',
  alternates: { canonical: '/guides' },
};

export default function GuidesIndexPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-mono text-title font-600 text-ink">Guides</h1>
        <p className="text-body text-muted">
          Plain-language explanations of the errors developers actually hit — what they mean, what
          causes them, and how to fix them. Every guide links to the matching in-browser tool so
          you can locate the exact line in your own data.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-section font-600 text-ink">JSON parse errors</h2>
        <ul className="flex flex-col gap-2">
          {JSON_ERROR_GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="group flex flex-col gap-1 rounded-md border border-border bg-surface p-4 transition-colors duration-fade hover:border-accent"
              >
                <span className="font-mono text-body font-600 text-ink group-hover:text-accent">
                  “{g.error}”
                </span>
                <span className="text-label text-muted">{g.metaDescription}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
