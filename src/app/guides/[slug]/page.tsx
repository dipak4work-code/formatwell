import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JSON_ERROR_GUIDES, getGuide } from '@/lib/guides/jsonErrors';
import { SITE, TOOLS } from '@/lib/site';

export function generateStaticParams() {
  return JSON_ERROR_GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = getGuide(params.slug);
  if (!guide) return {};
  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: { canonical: `/guides/${guide.slug}` },
  };
}

function CodeBox({ label, code, tone }: { label: string; code: string; tone: 'bad' | 'good' }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <p
        className={
          'border-b border-border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ' +
          (tone === 'bad' ? 'text-invalid' : 'text-valid')
        }
      >
        {label}
      </p>
      <pre className="overflow-x-auto bg-surface p-3 font-mono text-label leading-6 text-ink">
        {code}
      </pre>
    </div>
  );
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const tool = TOOLS.find((t) => t.id === guide.tool)!;
  const related = guide.related
    .map((slug) => getGuide(slug))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: guide.metaTitle,
    description: guide.metaDescription,
    url: `${SITE.url}/guides/${guide.slug}/`,
    author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
  };

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase tracking-wide text-muted">
          <Link href="/guides" className="hover:text-accent">
            Guides
          </Link>{' '}
          / JSON errors
        </p>
        <h1 className="font-mono text-title font-600 leading-tight text-ink">
          “{guide.error}”
        </h1>
        <div className="mt-1 rounded-md border border-border bg-surface p-3">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted">
            How it appears per engine
          </p>
          <ul className="flex flex-col gap-1">
            {guide.browsers.map((b) => (
              <li key={b} className="font-mono text-label text-muted">
                {b}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-section font-600 text-ink">What this error means</h2>
        {guide.meaning.map((p, i) => (
          <p key={i} className="text-body text-muted">
            {p}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-mono text-section font-600 text-ink">Common causes</h2>
        {guide.causes.map((cause, i) => (
          <div key={i} className="flex flex-col gap-2">
            <h3 className="font-mono text-body font-600 text-ink">
              {i + 1}. {cause.title}
            </h3>
            <p className="text-body text-muted">{cause.body}</p>
            {cause.bad && <CodeBox label="Fails" code={cause.bad} tone="bad" />}
            {cause.good && <CodeBox label="Works" code={cause.good} tone="good" />}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-section font-600 text-ink">How to fix it</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {guide.fixes.map((f, i) => (
            <li key={i} className="text-body text-muted">
              {f}
            </li>
          ))}
        </ol>
      </section>

      <aside className="rounded-lg border border-accent/40 bg-accent/5 p-4">
        <p className="font-mono text-body font-600 text-ink">Find the exact line in seconds</p>
        <p className="mt-1 text-body text-muted">
          Paste your data into the free {tool.label} validator — it runs entirely in your browser
          (nothing is uploaded) and points at the precise line and column of the problem.
        </p>
        <Link
          href={tool.href}
          className="mt-3 inline-block rounded-md border border-accent bg-accent/10 px-3 py-1.5 font-mono text-label text-accent transition-colors duration-fade hover:bg-accent/20"
        >
          Open the {tool.label} validator →
        </Link>
      </aside>

      {related.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-border pt-6">
          <h2 className="font-mono text-section font-600 text-ink">Related errors</h2>
          <ul className="flex flex-col gap-1">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/guides/${r.slug}`}
                  className="font-mono text-label text-accent hover:underline"
                >
                  “{r.error}”
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
