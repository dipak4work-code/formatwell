import type { ParseIssue, ParseResult } from './types';
import { mapJsonError } from './json';
import { byteLength } from '@/lib/utils/bytes';

export type JsonlIndent = 2 | 4 | 'tab';

function indentValue(indent: JsonlIndent): string | number {
  return indent === 'tab' ? '\t' : indent;
}

function makeStats(text: string, parseMs: number, records?: number): ParseResult['stats'] {
  return {
    bytes: byteLength(text),
    lines: text.length === 0 ? 0 : text.split('\n').length,
    parseMs,
    ...(records !== undefined ? { records } : {}),
  };
}

/** Split into lines, remembering 1-based line numbers and stripping a trailing CR. */
function splitLines(input: string): string[] {
  return input.split('\n').map((l) => l.replace(/\r$/, ''));
}

/**
 * Validate JSONL (JSON Lines / NDJSON): every non-blank line must be a single valid
 * JSON value. Errors are located at the file line, with the column taken from the JSON
 * error within that line. Blank lines are rejected (except a single trailing newline).
 */
export function validateJsonl(input: string): ParseResult {
  const start = performance.now();
  if (input.trim().length === 0) {
    return { ok: false, errors: [], stats: makeStats(input, 0) };
  }

  const lines = splitLines(input);
  const errors: ParseIssue[] = [];
  let records = 0;

  for (let i = 0; i < lines.length; i++) {
    const content = lines[i]!;
    const lineNo = i + 1;

    if (content.trim().length === 0) {
      // A single trailing blank line (from a final newline) is allowed.
      if (i === lines.length - 1) continue;
      errors.push({
        line: lineNo,
        column: 1,
        message: 'Blank lines are not allowed in JSONL — each line must be one JSON value.',
        severity: 'error',
      });
      continue;
    }

    try {
      JSON.parse(content);
      records++;
    } catch (e) {
      const mapped = mapJsonError(content, e);
      // The line is a single row, so the mapped line (1) becomes this file line.
      errors.push({ ...mapped, line: lineNo });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    stats: makeStats(input, performance.now() - start, records),
  };
}

/** Canonical JSONL: each record minified on its own line. Validates first. */
export function minifyJsonl(input: string): ParseResult {
  const start = performance.now();
  const validation = validateJsonl(input);
  if (!validation.ok) return validation;

  const out = splitLines(input)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.stringify(JSON.parse(l)))
    .join('\n');

  return { ok: true, formatted: out, errors: [], stats: makeStats(input, performance.now() - start) };
}

/** Convert JSONL to a pretty-printed JSON array of its records. Validates first. */
export function jsonlToArray(input: string, indent: JsonlIndent = 2): ParseResult {
  const start = performance.now();
  const validation = validateJsonl(input);
  if (!validation.ok) return validation;

  const records = splitLines(input)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as unknown);

  const out = JSON.stringify(records, null, indentValue(indent));
  return { ok: true, formatted: out, errors: [], stats: makeStats(input, performance.now() - start) };
}

/**
 * Convert a JSON array into JSONL (one minified record per line). The input here must be
 * a single JSON array, so errors are reported at line/column within the whole input.
 */
export function arrayToJsonl(input: string): ParseResult {
  const start = performance.now();
  if (input.trim().length === 0) {
    return { ok: false, errors: [], stats: makeStats(input, 0) };
  }

  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch (e) {
    return {
      ok: false,
      errors: [mapJsonError(input, e)],
      stats: makeStats(input, performance.now() - start),
    };
  }

  if (!Array.isArray(value)) {
    return {
      ok: false,
      errors: [
        {
          line: 1,
          column: 1,
          message: 'Input must be a JSON array to convert to JSONL.',
          severity: 'error',
        },
      ],
      stats: makeStats(input, performance.now() - start),
    };
  }

  const out = value.map((v) => JSON.stringify(v)).join('\n');
  return { ok: true, formatted: out, errors: [], stats: makeStats(input, performance.now() - start) };
}

/** Parsed records for the tree view, or null when the input isn't valid JSONL. */
export function parseJsonlRecords(input: string): unknown[] | null {
  if (!validateJsonl(input).ok) return null;
  return splitLines(input)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as unknown);
}
