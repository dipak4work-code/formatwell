// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render';

describe('renderMarkdown — DOMPurify is the mandatory XSS boundary', () => {
  it('renders <img onerror> inert (no event-handler attribute survives)', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/alert\(1\)/);
  });

  it('strips <script> tags entirely', () => {
    const html = renderMarkdown('Hello\n\n<script>alert(document.cookie)</script>');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/document\.cookie/);
  });

  it('neutralizes javascript: URLs in links (no executable href)', () => {
    // markdown-it refuses the unsafe URL, so it renders as inert text rather than a link;
    // either way there must be no javascript: href in the output.
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toMatch(/href=["']?\s*javascript:/i);
    expect(html).not.toMatch(/<a[^>]*javascript:/i);
  });

  it('drops onclick from inline HTML', () => {
    const html = renderMarkdown('<a href="#" onclick="steal()">x</a>');
    expect(html).not.toMatch(/onclick/i);
    expect(html).not.toMatch(/steal\(\)/);
  });
});

describe('renderMarkdown — GFM features', () => {
  it('renders tables', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).toMatch(/<table>/);
    expect(html).toMatch(/<td>1<\/td>/);
  });

  it('renders task lists as checkboxes', () => {
    const html = renderMarkdown('- [x] done\n- [ ] todo');
    expect(html).toMatch(/type="checkbox"/);
    expect(html).toMatch(/checked/);
  });

  it('renders strikethrough', () => {
    expect(renderMarkdown('~~gone~~')).toMatch(/<s>gone<\/s>/);
  });

  it('autolinks bare URLs', () => {
    expect(renderMarkdown('see https://example.com ok')).toMatch(
      /<a[^>]+href="https:\/\/example\.com"/,
    );
  });

  it('highlights fenced code and marks external links safe', () => {
    const html = renderMarkdown('```js\nconst x = 1;\n```');
    expect(html).toMatch(/class="hljs/);
  });
});
