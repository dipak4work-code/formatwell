/** Central site metadata and navigation — single source of truth for brand + routes. */

export const SITE = {
  name: 'FormatWell',
  tagline:
    'Validate, format, and preview JSON, JSONL, XML, and Markdown — entirely in your browser.',
  privacyPromise: 'Everything runs in your browser. Your data never leaves your device.',
  // Used for absolute URLs in metadata / sitemap. Override at deploy time if needed.
  url: 'https://validateformat.com',
} as const;

export type ToolId = 'json' | 'jsonl' | 'xml' | 'markdown';

export interface ToolMeta {
  id: ToolId;
  href: string;
  label: string;
  title: string;
  description: string;
}

export const TOOLS: ToolMeta[] = [
  {
    id: 'json',
    href: '/json',
    label: 'JSON',
    title: 'JSON viewer, formatter & validator',
    description:
      'Validate, format, minify, and explore JSON with exact error line and column numbers.',
  },
  {
    id: 'jsonl',
    href: '/jsonl',
    label: 'JSONL',
    title: 'JSONL / NDJSON viewer, validator & converter',
    description:
      'Validate JSON Lines (NDJSON) with per-line errors, minify, browse records, and convert to or from a JSON array.',
  },
  {
    id: 'xml',
    href: '/xml',
    label: 'XML',
    title: 'XML viewer, formatter & validator',
    description:
      'Check XML well-formedness, pretty-print, and browse the element tree — with located errors.',
  },
  {
    id: 'markdown',
    href: '/markdown',
    label: 'Markdown',
    title: 'Markdown editor, preview & linter',
    description:
      'Write Markdown with a live, sanitized preview and lint hints. GitHub-flavored, XSS-safe.',
  },
];

export const NAV = [...TOOLS.map((t) => ({ href: t.href, label: t.label }))];
