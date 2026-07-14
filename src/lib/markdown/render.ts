import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js/lib/common';
import DOMPurify, { type Config } from 'dompurify';

/**
 * GFM-flavored Markdown renderer. `html: true` lets authors write inline HTML, but
 * EVERY rendered string is passed through DOMPurify before it reaches the DOM — this is
 * the single, mandatory XSS boundary (spec §7.3). Do not render Markdown any other way.
 */
const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true, // autolink bare URLs
  breaks: false,
  highlight(str, lang): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const { value } = hljs.highlight(str, { language: lang, ignoreIllegals: true });
        return `<pre class="hljs"><code class="hljs language-${lang}">${value}</code></pre>`;
      } catch {
        /* fall through to escaped plain text */
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
}).use(taskLists, { enabled: true, label: true });

// Open links in a new tab safely.
DOMPurify.addHook?.('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
  }
});

const SANITIZE_CONFIG: Config = {
  USE_PROFILES: { html: true },
  // Task-list checkboxes.
  ADD_ATTR: ['checked', 'disabled', 'type'],
  RETURN_TRUSTED_TYPE: false,
};

/** Render Markdown to sanitized, display-ready HTML. */
export function renderMarkdown(input: string): string {
  const raw = md.render(input);
  return DOMPurify.sanitize(raw, SANITIZE_CONFIG) as string;
}
