import { describe, expect, it } from 'vitest';
import {
  formatJson,
  indexToLineCol,
  minifyJson,
  validateJson,
} from './json';

describe('indexToLineCol', () => {
  it('maps a flat index to 1-based line/column', () => {
    expect(indexToLineCol('abc', 0)).toEqual({ line: 1, column: 1 });
    expect(indexToLineCol('abc', 2)).toEqual({ line: 1, column: 3 });
  });

  it('counts newlines for multi-line input', () => {
    const text = 'a\nbb\nccc';
    expect(indexToLineCol(text, 2)).toEqual({ line: 2, column: 1 }); // first char of line 2
    expect(indexToLineCol(text, 5)).toEqual({ line: 3, column: 1 });
  });

  it('clamps out-of-range indices', () => {
    expect(indexToLineCol('ab', 99)).toEqual({ line: 1, column: 3 });
    expect(indexToLineCol('ab', -5)).toEqual({ line: 1, column: 1 });
  });
});

describe('validateJson — valid inputs', () => {
  it('accepts well-formed JSON and reports stats', () => {
    const r = validateJson('{"a": 1, "b": [2, 3]}');
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.stats?.bytes).toBeGreaterThan(0);
  });

  it('treats empty/whitespace input as not-ok but without errors', () => {
    const r = validateJson('   \n  ');
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(0);
  });
});

// 10 malformed fixtures — each must produce exactly one located, non-generic error.
describe('validateJson — malformed fixtures locate the error', () => {
  const fixtures: Array<{ name: string; input: string; line: number; column: number }> = [
    { name: 'trailing comma before }', input: '{"a":1,}', line: 1, column: 8 },
    { name: 'trailing comma in array', input: '[1, 2, ]', line: 1, column: 8 },
    { name: 'missing colon', input: '{"a" "b"}', line: 1, column: 6 },
    { name: 'missing comma between props (multiline)', input: '{\n  "a": 1\n  "b": 2\n}', line: 3, column: 3 },
    { name: 'unclosed array', input: '[1, 2, 3', line: 1, column: 9 },
    { name: 'unclosed object', input: '{"a": 1', line: 1, column: 8 },
    { name: 'single quotes', input: "{'a': 1}", line: 1, column: 2 },
    // 'f' is a valid start of `false`, so the divergence is located at the following 'o'.
    { name: 'bare word value', input: '{"a": foo}', line: 1, column: 8 },
    { name: 'not json at all', input: 'hello', line: 1, column: 1 },
    { name: 'value then garbage', input: '{"a":1} extra', line: 1, column: 9 },
  ];

  for (const f of fixtures) {
    it(f.name, () => {
      const r = validateJson(f.input);
      expect(r.ok).toBe(false);
      expect(r.errors).toHaveLength(1);
      const err = r.errors[0]!;
      expect(err.severity).toBe('error');
      expect(err.message.length).toBeGreaterThan(0);
      // Message must be plain — no engine noise.
      expect(err.message).not.toMatch(/in JSON at position/i);
      expect(err.message).not.toMatch(/is not valid JSON/i);
      expect({ line: err.line, column: err.column }).toEqual({
        line: f.line,
        column: f.column,
      });
    });
  }
});

describe('formatJson', () => {
  it('pretty-prints with 2-space indent by default', () => {
    const r = formatJson('{"a":1,"b":2}');
    expect(r.ok).toBe(true);
    expect(r.formatted).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('supports 4-space and tab indent', () => {
    expect(formatJson('{"a":1}', { indent: 4 }).formatted).toBe('{\n    "a": 1\n}');
    expect(formatJson('{"a":1}', { indent: 'tab' }).formatted).toBe('{\n\t"a": 1\n}');
  });

  it('returns a located error for malformed input (no formatted output)', () => {
    const r = formatJson('{"a":1,}');
    expect(r.ok).toBe(false);
    expect(r.formatted).toBeUndefined();
    expect(r.errors[0]).toMatchObject({ line: 1, column: 8 });
  });
});

describe('minifyJson', () => {
  it('collapses whitespace', () => {
    expect(minifyJson('{\n  "a": 1,\n  "b": [2, 3]\n}').formatted).toBe('{"a":1,"b":[2,3]}');
  });
});

describe('round-trip: format → minify → format preserves data', () => {
  it('is stable and lossless', () => {
    const original = '{"z":[3,2,1],"a":{"nested":true,"n":0.5},"s":"héllo"}';
    const formatted = formatJson(original).formatted!;
    const minified = minifyJson(formatted).formatted!;
    const reformatted = formatJson(minified).formatted!;
    expect(formatted).toBe(reformatted);
    // Semantic equality preserved.
    expect(JSON.parse(minified)).toEqual(JSON.parse(original));
  });
});
