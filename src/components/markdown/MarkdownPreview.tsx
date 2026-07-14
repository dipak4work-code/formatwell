'use client';

import { forwardRef, useEffect, useState } from 'react';

interface MarkdownPreviewProps {
  source: string;
}

/**
 * Renders sanitized Markdown HTML. Rendering runs only on the client (in an effect) so
 * DOMPurify always has a DOM and nothing unsafe is produced during static prerender.
 */
export const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview({ source }, ref) {
    const [html, setHtml] = useState('');

    useEffect(() => {
      let cancelled = false;
      // Lazy-load markdown-it + highlight.js + DOMPurify so they stay out of initial JS.
      void import('@/lib/markdown/render').then(({ renderMarkdown }) => {
        if (!cancelled) setHtml(renderMarkdown(source));
      });
      return () => {
        cancelled = true;
      };
    }, [source]);

    return (
      <div ref={ref} className="h-full overflow-auto bg-surface">
        {source.trim().length === 0 ? (
          <p className="p-4 font-mono text-label text-muted">
            Your rendered preview will appear here.
          </p>
        ) : (
          <div
            className="md-preview p-4"
            // Sanitized by renderMarkdown → DOMPurify (spec §7.3).
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    );
  },
);
