import { describe, expect, it } from 'vitest';
import {
  arrayToJsonl,
  jsonlToArray,
  minifyJsonl,
  parseJsonlRecords,
  validateJsonl,
} from './jsonl';

describe('validateJsonl — valid', () => {
  it('accepts one JSON value per line', () => {
    const r = validateJsonl('{"a":1}\n{"a":2}\n{"a":3}');
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.stats?.records).toBe(3);
  });

  it('allows a single trailing newline', () => {
    expect(validateJsonl('{"a":1}\n{"a":2}\n').ok).toBe(true);
  });

  it('accepts non-object JSON values per line', () => {
    expect(validateJsonl('1\n"two"\n[3,4]\ntrue\nnull').ok).toBe(true);
  });

  it('treats empty input as not-ok without errors', () => {
    const r = validateJsonl('   ');
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(0);
  });
});

describe('validateJsonl — locates per-line errors', () => {
  it('reports the file line and the JSON column for a bad line', () => {
    const r = validateJsonl('{"a":1}\n{"a":2,}\n{"a":3}');
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 2, column: 8, severity: 'error' });
  });

  it('rejects interior blank lines but not the trailing one', () => {
    const r = validateJsonl('{"a":1}\n\n{"a":2}');
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({ line: 2, severity: 'error' });
    expect(r.errors[0]!.message).toMatch(/blank lines/i);
  });

  it('flags a line that is not valid JSON (e.g. a JSON array spread across lines)', () => {
    // Second line "{" alone is invalid on its own.
    const r = validateJsonl('{"a":1}\n{\n"a":2}');
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(1);
  });
});

describe('minifyJsonl', () => {
  it('canonicalizes each record to one minified line', () => {
    const r = minifyJsonl('{ "a": 1 }\n{  "b":  2 }\n');
    expect(r.ok).toBe(true);
    expect(r.formatted).toBe('{"a":1}\n{"b":2}');
  });

  it('returns located error for invalid input', () => {
    const r = minifyJsonl('{"a":1}\n{bad}');
    expect(r.ok).toBe(false);
    expect(r.formatted).toBeUndefined();
    expect(r.errors[0]!.line).toBe(2);
  });
});

describe('jsonlToArray', () => {
  it('wraps records in a pretty JSON array', () => {
    const r = jsonlToArray('{"a":1}\n{"a":2}', 2);
    expect(r.ok).toBe(true);
    expect(r.formatted).toBe('[\n  {\n    "a": 1\n  },\n  {\n    "a": 2\n  }\n]');
  });
});

describe('arrayToJsonl', () => {
  it('converts a JSON array to one minified record per line', () => {
    const r = arrayToJsonl('[{"a":1}, {"b":2}, 3]');
    expect(r.ok).toBe(true);
    expect(r.formatted).toBe('{"a":1}\n{"b":2}\n3');
  });

  it('round-trips with jsonlToArray', () => {
    const jsonl = '{"a":1}\n{"a":2}';
    const arr = jsonlToArray(jsonl).formatted!;
    expect(arrayToJsonl(arr).formatted).toBe(jsonl);
  });

  it('errors when input is not a JSON array', () => {
    const r = arrayToJsonl('{"a":1}');
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.message).toMatch(/must be a JSON array/i);
  });
});

describe('parseJsonlRecords', () => {
  it('returns the parsed records for the tree', () => {
    expect(parseJsonlRecords('{"a":1}\n{"a":2}')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('returns null for invalid JSONL', () => {
    expect(parseJsonlRecords('{"a":1}\n{bad}')).toBeNull();
  });
});
