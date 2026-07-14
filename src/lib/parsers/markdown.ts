import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkPresetLintRecommended from 'remark-preset-lint-recommended';
import remarkLintHeadingIncrement from 'remark-lint-heading-increment';
import type { ParseIssue, ParseResult } from './types';
import { byteLength } from '@/lib/utils/bytes';

function makeStats(text: string, parseMs: number): ParseResult['stats'] {
  return {
    bytes: byteLength(text),
    lines: text.length === 0 ? 0 : text.split('\n').length,
    parseMs,
  };
}

function tidy(reason: string): string {
  const trimmed = reason.trim();
  const withDot = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return withDot.charAt(0).toUpperCase() + withDot.slice(1);
}

/**
 * Lint Markdown with the remark-lint recommended preset (plus heading-increment) over a
 * GFM parser. All findings are surfaced as `warning` severity — Markdown lint is advisory,
 * never a hard failure. Never throws: lint problems must not break the preview.
 */
export async function lintMarkdown(input: string): Promise<ParseResult> {
  const start = performance.now();
  if (input.trim().length === 0) {
    return { ok: true, errors: [], stats: makeStats(input, 0) };
  }

  try {
    const file = await remark()
      .use(remarkGfm)
      .use(remarkPresetLintRecommended)
      .use(remarkLintHeadingIncrement)
      .process(input);

    const errors: ParseIssue[] = file.messages.map((m) => ({
      line: m.line ?? 1,
      column: m.column ?? 1,
      message: m.ruleId ? `${tidy(m.reason)} (${m.ruleId})` : tidy(m.reason),
      severity: 'warning',
    }));

    // ok stays true even with warnings — the document still renders.
    return { ok: true, errors, stats: makeStats(input, performance.now() - start) };
  } catch {
    return { ok: true, errors: [], stats: makeStats(input, performance.now() - start) };
  }
}
