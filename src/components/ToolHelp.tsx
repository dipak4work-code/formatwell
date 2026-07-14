export interface Faq {
  q: string;
  a: string;
}

interface ToolHelpProps {
  heading: string;
  intro: string[];
  faqs: Faq[];
}

/**
 * Real on-page help + FAQ content that sits below each tool (spec §4). Emits FAQPage
 * JSON-LD so the questions are eligible for rich results (spec §11).
 */
export function ToolHelp({ heading, intro, faqs }: ToolHelpProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <section className="mt-10 flex max-w-3xl flex-col gap-6 border-t border-border pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-section font-600 text-ink">{heading}</h2>
        {intro.map((p, i) => (
          <p key={i} className="text-body text-muted">
            {p}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-mono text-section font-600 text-ink">Frequently asked questions</h2>
        <dl className="flex flex-col gap-4">
          {faqs.map((f, i) => (
            <div key={i} className="flex flex-col gap-1">
              <dt className="font-mono text-label font-500 text-ink">{f.q}</dt>
              <dd className="text-body text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
