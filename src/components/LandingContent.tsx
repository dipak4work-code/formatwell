import Link from 'next/link';
import type { ReactNode } from 'react';
import { SITE, TOOLS, type ToolId } from '@/lib/site';

/**
 * Landing content (spec §8.3): one plain sentence, three tool cards each showing a live
 * 3-line syntax-highlighted snippet (not an icon), and the privacy promise.
 * Snippets are hand-tokenized with palette colors so the landing page ships no highlighter.
 */

// Token colors follow the editor theme; semantic greens/ambers here are syntax, not state.
const p = (t: string) => <span className="text-muted">{t}</span>; // punctuation
const k = (t: string) => <span className="text-ink">{t}</span>; // key / name
const s = (t: string) => <span className="text-valid">{t}</span>; // string
const n = (t: string) => <span className="text-warn">{t}</span>; // number / literal
const a = (t: string) => <span className="text-accent">{t}</span>; // tag / accent

const SNIPPETS: Record<ToolId, ReactNode> = {
  json: (
    <>
      <div>{p('{')}</div>
      <div>
        {'  '}
        {k('"status"')}
        {p(': ')}
        {s('"ok"')}
        {p(', ')}
        {k('"count"')}
        {p(': ')}
        {n('42')}
      </div>
      <div>{p('}')}</div>
    </>
  ),
  jsonl: (
    <>
      <div>
        {p('{')}
        {k('"id"')}
        {p(':')}
        {n('1')}
        {p(',')}
        {k('"ok"')}
        {p(':')}
        {n('true')}
        {p('}')}
      </div>
      <div>
        {p('{')}
        {k('"id"')}
        {p(':')}
        {n('2')}
        {p(',')}
        {k('"ok"')}
        {p(':')}
        {n('false')}
        {p('}')}
      </div>
      <div>
        {p('{')}
        {k('"id"')}
        {p(':')}
        {n('3')}
        {p(',')}
        {k('"ok"')}
        {p(':')}
        {n('true')}
        {p('}')}
      </div>
    </>
  ),
  xml: (
    <>
      <div>
        {p('<')}
        {a('user')} {k('id')}
        {p('=')}
        {s('"42"')}
        {p('>')}
      </div>
      <div>
        {'  '}
        {p('<')}
        {a('name')}
        {p('>')}Ada{p('</')}
        {a('name')}
        {p('>')}
      </div>
      <div>
        {p('</')}
        {a('user')}
        {p('>')}
      </div>
    </>
  ),
  markdown: (
    <>
      <div>
        {a('# ')}
        {k('Release notes')}
      </div>
      <div>
        {n('- [x] ')}ship it
      </div>
      <div>
        {p('**')}
        {k('bold')}
        {p('**')} and {p('`')}
        {s('code')}
        {p('`')}
      </div>
    </>
  ),
};

function StructuredData() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE.name,
        url: SITE.url,
        description: SITE.tagline,
      },
      {
        '@type': 'ItemList',
        itemListElement: TOOLS.map((tool, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: tool.title,
          url: `${SITE.url}${tool.href}/`,
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function LandingContent() {
  return (
    <div className="flex flex-col gap-10">
      <StructuredData />
      <section className="flex flex-col gap-3">
        <p className="font-mono text-label uppercase tracking-wide text-muted">Developer tools</p>
        <h1 className="max-w-2xl font-mono text-title font-600 text-ink">{SITE.tagline}</h1>
        <p className="max-w-2xl text-body text-muted">{SITE.privacyPromise}</p>
      </section>

      <section aria-label="Tools" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 transition-colors duration-fade hover:border-accent"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-section font-600 text-ink group-hover:text-accent">
                {tool.label}
              </span>
              <span aria-hidden="true" className="font-mono text-label text-muted group-hover:text-accent">
                →
              </span>
            </div>
            <pre
              aria-hidden="true"
              className="overflow-hidden rounded-md border border-border bg-bg p-3 font-mono text-[12px] leading-5"
            >
              {SNIPPETS[tool.id]}
            </pre>
            <span className="text-body text-muted">{tool.description}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
