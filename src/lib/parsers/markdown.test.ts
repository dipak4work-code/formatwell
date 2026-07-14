import { describe, expect, it } from 'vitest';
import { lintMarkdown } from './markdown';

function rules(errors: { message: string }[]): string[] {
  return errors.map((e) => e.message);
}

describe('lintMarkdown', () => {
  it('returns ok with no warnings for clean Markdown', async () => {
    const r = await lintMarkdown('# Title\n\nA clean paragraph.\n');
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('flags bare URLs, heading increment jumps, and undefined references — all as warnings', async () => {
    const md = [
      '# Title',
      '',
      '### Skipped a level',
      '',
      'Visit https://example.com now.',
      '',
      'See [missing][undefined-ref] here.',
      '',
    ].join('\n');

    const r = await lintMarkdown(md);
    expect(r.ok).toBe(true);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
    expect(r.errors.every((e) => e.severity === 'warning')).toBe(true);
    expect(r.errors.every((e) => e.line >= 1 && e.column >= 1)).toBe(true);

    const joined = rules(r.errors).join(' | ');
    expect(joined).toMatch(/no-literal-urls/);
    expect(joined).toMatch(/heading-increment/);
    expect(joined).toMatch(/no-undefined-references/);
  });

  it('never throws and treats empty input as ok', async () => {
    const r = await lintMarkdown('   ');
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});
