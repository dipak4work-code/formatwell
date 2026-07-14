import type { ParseIssue, ParseResult } from './types';
import { byteLength } from '@/lib/utils/bytes';

/** Convert a 0-based character index into 1-based line/column. */
export function indexToLineCol(text: string, index: number): { line: number; column: number } {
  const clamped = Math.min(Math.max(index, 0), text.length);
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: clamped - lastNewline };
}

/**
 * Native JSON.parse error messages differ per engine and rarely carry a position we
 * can trust cross-browser. This maps whatever the engine gives us to a located,
 * plain-language issue:
 *   - V8 (newer): "... in JSON at position 61 (line 4 column 3)"
 *   - V8 (older): "Unexpected token } in JSON at position 12"
 *   - Firefox:    "JSON.parse: ... at line 4 column 3 of the JSON data"
 *   - Safari:     "JSON Parse error: Expected '}'"  (no position)
 */
export function mapJsonError(text: string, error: unknown): ParseIssue {
  const raw = error instanceof Error ? error.message : String(error);

  let line: number | null = null;
  let column: number | null = null;

  const lineCol = raw.match(/line (\d+) column (\d+)/i);
  if (lineCol) {
    line = Number(lineCol[1]);
    column = Number(lineCol[2]);
  } else {
    const pos = raw.match(/position (\d+)/i);
    if (pos) {
      const mapped = indexToLineCol(text, Number(pos[1]));
      line = mapped.line;
      column = mapped.column;
    }
  }

  if (line === null || column === null) {
    // No engine-provided location: scan for the first structural problem by trimming
    // from the end until it parses, to approximate the failure point.
    const scanned = scanForFailure(text);
    line = scanned.line;
    column = scanned.column;
  }

  return { line, column, message: cleanMessage(raw), severity: 'error' };
}

/** Strip engine-specific "in JSON at position…"/"of the JSON data" noise. */
function cleanMessage(raw: string): string {
  let msg = raw
    .replace(/^JSON\.parse:\s*/i, '')
    .replace(/^JSON Parse error:\s*/i, '')
    .replace(/\s+in JSON at position \d+.*$/i, '')
    .replace(/\s+at line \d+ column \d+ of the JSON data\.?$/i, '')
    .replace(/\s+\(line \d+ column \d+\)\.?$/i, '')
    // Newer V8 embeds the whole input: `... , "<input>" is not valid JSON`.
    .replace(/,?\s*"[\s\S]*"\s*is not valid JSON\.?$/i, '')
    .replace(/\s*is not valid JSON\.?$/i, '')
    .trim();
  if (!msg) msg = 'Invalid JSON.';
  // Sentence-case-ish, ensure trailing period.
  if (!/[.!?]$/.test(msg)) msg += '.';
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

/**
 * True when a prefix fails to parse *only because it is truncated* — i.e. the engine
 * reports "unexpected end", or points the error at the prefix's own end. Such a prefix
 * is still on a valid path, so the scan should keep extending past it.
 */
function isTruncationError(slice: string, error: unknown): boolean {
  const m = error instanceof Error ? error.message : '';
  if (/end of (data|JSON|input)|Unexpected end/i.test(m)) return true;
  const pos = m.match(/position (\d+)/i);
  if (pos) return Number(pos[1]) >= slice.length;
  return false;
}

/** Best-effort location when the engine gives none: binary-search the longest valid prefix. */
function scanForFailure(text: string): { line: number; column: number } {
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const slice = text.slice(0, mid);
    try {
      JSON.parse(slice);
      lo = mid;
    } catch (e) {
      if (isTruncationError(slice, e)) lo = mid;
      else hi = mid - 1;
    }
  }
  return indexToLineCol(text, lo);
}

export interface JsonFormatOptions {
  /** 2, 4, or 'tab'. */
  indent?: number | 'tab';
}

function indentValue(opts?: JsonFormatOptions): string | number {
  const indent = opts?.indent ?? 2;
  return indent === 'tab' ? '\t' : indent;
}

function makeStats(text: string, parseMs: number): ParseResult['stats'] {
  return {
    bytes: byteLength(text),
    lines: text.length === 0 ? 0 : text.split('\n').length,
    parseMs,
  };
}

/** Validate JSON, returning located errors. */
export function validateJson(input: string): ParseResult {
  const start = performance.now();
  const text = input;
  if (text.trim().length === 0) {
    return { ok: false, errors: [], stats: makeStats(text, 0) };
  }
  try {
    JSON.parse(text);
    return { ok: true, errors: [], stats: makeStats(text, performance.now() - start) };
  } catch (e) {
    return {
      ok: false,
      errors: [mapJsonError(text, e)],
      stats: makeStats(text, performance.now() - start),
    };
  }
}

/** Pretty-print JSON. On failure returns the located error (formatted is absent). */
export function formatJson(input: string, opts?: JsonFormatOptions): ParseResult {
  const start = performance.now();
  if (input.trim().length === 0) {
    return { ok: false, errors: [], stats: makeStats(input, 0) };
  }
  try {
    const value = JSON.parse(input);
    const formatted = JSON.stringify(value, null, indentValue(opts));
    return {
      ok: true,
      formatted,
      errors: [],
      stats: makeStats(input, performance.now() - start),
    };
  } catch (e) {
    return {
      ok: false,
      errors: [mapJsonError(input, e)],
      stats: makeStats(input, performance.now() - start),
    };
  }
}

/** Minify JSON. On failure returns the located error. */
export function minifyJson(input: string): ParseResult {
  const start = performance.now();
  if (input.trim().length === 0) {
    return { ok: false, errors: [], stats: makeStats(input, 0) };
  }
  try {
    const value = JSON.parse(input);
    const formatted = JSON.stringify(value);
    return {
      ok: true,
      formatted,
      errors: [],
      stats: makeStats(input, performance.now() - start),
    };
  } catch (e) {
    return {
      ok: false,
      errors: [mapJsonError(input, e)],
      stats: makeStats(input, performance.now() - start),
    };
  }
}
