// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { markdownToStandaloneHtml, inferTitle } from './exportHtml';
import { markdownToBlocks } from './exportPdf';

describe('inferTitle', () => {
  it('uses the first heading', () => {
    expect(inferTitle('# Release **notes**\n\ntext')).toBe('Release notes');
  });
  it('falls back to the first line, then to Document', () => {
    expect(inferTitle('plain opening line\nmore')).toBe('plain opening line');
    expect(inferTitle('   \n  ')).toBe('Document');
  });
});

describe('markdownToStandaloneHtml', () => {
  it('produces a self-contained document with the rendered body', () => {
    const html = markdownToStandaloneHtml('# Hello\n\nSome **bold** text.');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Hello</title>');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<style>');
    // Self-contained: no external requests.
    expect(html).not.toMatch(/src="http|href="http.*\.css/);
  });

  it('keeps the DOMPurify boundary — injected script renders inert', () => {
    const html = markdownToStandaloneHtml('hi\n\n<img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/<script/i);
  });
});

describe('markdownToBlocks', () => {
  it('maps headings with inline styles', () => {
    const blocks = markdownToBlocks('## Fast *and* **safe**');
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 2 });
    const segs = (blocks[0] as { segs: Array<{ text: string; bold?: boolean; italic?: boolean }> })
      .segs;
    expect(segs.find((s) => s.italic)?.text).toBe('and');
    expect(segs.find((s) => s.bold)?.text).toBe('safe');
  });

  it('maps fenced code, quotes, and hr', () => {
    const blocks = markdownToBlocks('> quoted\n\n```js\nconst a = 1;\n```\n\n---\n');
    expect(blocks.map((b) => b.kind)).toEqual(['para', 'code', 'hr']);
    expect(blocks[0]).toMatchObject({ quote: true });
    expect(blocks[1]).toMatchObject({ text: 'const a = 1;' });
  });

  it('maps nested lists with markers and indent', () => {
    const blocks = markdownToBlocks('1. first\n2. second\n   - nested\n');
    const paras = blocks.filter((b) => b.kind === 'para') as Array<{
      marker?: string;
      indent: number;
    }>;
    expect(paras[0]!.marker).toBe('1.');
    expect(paras[1]!.marker).toBe('2.');
    expect(paras[2]!.marker).toBe('•');
    expect(paras[2]!.indent).toBeGreaterThan(paras[0]!.indent);
  });

  it('maps tables into header and body rows', () => {
    const blocks = markdownToBlocks('| a | b |\n| - | - |\n| 1 | 2 |\n');
    const rows = blocks.filter((b) => b.kind === 'table-row') as Array<{
      cells: string[];
      header: boolean;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ cells: ['a', 'b'], header: true });
    expect(rows[1]).toMatchObject({ cells: ['1', '2'], header: false });
  });

  it('renders links as text plus URL and images as placeholders', () => {
    const blocks = markdownToBlocks('[docs](https://example.com) and ![logo](x.png)');
    const segs = (blocks[0] as { segs: Array<{ text: string }> }).segs;
    const joined = segs.map((s) => s.text).join('');
    expect(joined).toContain('docs');
    expect(joined).toContain('(https://example.com)');
    expect(joined).toContain('[image: logo]');
  });
});
