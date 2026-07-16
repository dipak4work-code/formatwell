import { renderMarkdown } from './render';

/**
 * Wrap the sanitized rendered Markdown in a self-contained HTML document: inline CSS,
 * no external requests, light theme, print-friendly. The body passes through the same
 * DOMPurify pipeline as the live preview — this is the only way Markdown becomes HTML.
 */

function escapeTitle(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** First heading (or first non-empty line) as the document title. */
export function inferTitle(source: string): string {
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) return heading[1]!.replace(/[#*_`]/g, '').trim();
    return line.replace(/[#*_`>-]/g, '').trim().slice(0, 60) || 'Document';
  }
  return 'Document';
}

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; padding: 48px 24px; max-width: 760px;
    font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: #1e2230; background: #ffffff;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.6em 0 0.6em; }
  h1 { font-size: 1.9em; } h2 { font-size: 1.5em; } h3 { font-size: 1.2em; }
  h1:first-child { margin-top: 0; }
  p { margin: 0.8em 0; }
  a { color: #3d5afe; }
  code { font: 0.9em ui-monospace, Consolas, monospace; background: #f3f4f8; padding: 0.15em 0.35em; border-radius: 4px; }
  pre { background: #f3f4f8; border: 1px solid #e3e6ee; border-radius: 8px; padding: 14px 16px; overflow-x: auto; }
  pre code { background: none; padding: 0; font-size: 0.85em; }
  blockquote { margin: 1em 0; padding: 0.2em 1em; border-left: 3px solid #3d5afe; color: #5c6478; }
  ul, ol { padding-left: 1.6em; }
  li { margin: 0.25em 0; }
  li.task-list-item { list-style: none; margin-left: -1.3em; }
  hr { border: none; border-top: 1px solid #e3e6ee; margin: 2em 0; }
  table { border-collapse: collapse; margin: 1em 0; width: 100%; }
  th, td { border: 1px solid #e3e6ee; padding: 6px 12px; text-align: left; }
  th { background: #f7f8fa; }
  img { max-width: 100%; }
  @media print { body { padding: 0; } }
`;

export function markdownToStandaloneHtml(source: string): string {
  const body = renderMarkdown(source);
  const title = escapeTitle(inferTitle(source));
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    `<style>${STYLES}</style>`,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
  ].join('\n');
}
