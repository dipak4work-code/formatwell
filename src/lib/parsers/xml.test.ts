import { describe, expect, it } from 'vitest';
import { formatXml, minifyXml, parseXmlTree, validateXml } from './xml';

describe('validateXml — valid inputs', () => {
  it('accepts well-formed XML', () => {
    const r = validateXml('<root><a>1</a><b x="2"/></root>');
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts declaration, namespaces, comments, and CDATA', () => {
    const xml =
      '<?xml version="1.0"?><ns:root xmlns:ns="urn:x"><!-- c --><ns:a><![CDATA[ x<y ]]></ns:a></ns:root>';
    expect(validateXml(xml).ok).toBe(true);
  });

  it('treats empty input as not-ok without errors', () => {
    const r = validateXml('   ');
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(0);
  });
});

// §7.2 acceptance: each malformed case produces a located, plain-language error.
describe('validateXml — malformed fixtures locate the error', () => {
  const fixtures: Array<{ name: string; input: string }> = [
    { name: 'unclosed tag', input: '<a><b>1</a>' },
    { name: 'mismatched tag', input: '<a></b>' },
    { name: 'bad attribute quoting', input: '<a x=1></a>' },
    { name: 'illegal character', input: '<a>Tom & Jerry</a>' },
  ];

  for (const f of fixtures) {
    it(f.name, () => {
      const r = validateXml(f.input);
      expect(r.ok).toBe(false);
      expect(r.errors).toHaveLength(1);
      const err = r.errors[0]!;
      expect(err.severity).toBe('error');
      expect(err.line).toBeGreaterThanOrEqual(1);
      expect(err.column).toBeGreaterThanOrEqual(1);
      expect(err.message.length).toBeGreaterThan(0);
      expect(/[.!?]$/.test(err.message)).toBe(true); // ends as a sentence
    });
  }

  it('locates mismatched tag at the offending closing tag', () => {
    const err = validateXml('<a></b>').errors[0]!;
    expect(err.line).toBe(1);
    expect(err.column).toBe(4);
  });
});

describe('formatXml', () => {
  const src =
    '<?xml version="1.0"?><root><a x="1">hi</a><!-- c --><b><![CDATA[ x<y ]]></b></root>';

  it('pretty-prints and preserves declaration, comment, and CDATA', () => {
    const r = formatXml(src, 2);
    expect(r.ok).toBe(true);
    const out = r.formatted!;
    expect(out).toContain('<?xml version="1.0"?>');
    expect(out).toContain('<!-- c -->');
    expect(out).toContain('<![CDATA[ x<y ]]>');
    expect(out).toContain('\n'); // actually multi-line
    // Meaning preserved: re-minifying yields the original single line.
    expect(minifyXml(out).formatted).toBe(minifyXml(src).formatted);
  });

  it('supports tab indentation', () => {
    expect(formatXml('<r><a>1</a></r>', 'tab').formatted).toContain('\t<a>1</a>');
  });

  it('returns the located error for malformed input', () => {
    const r = formatXml('<a></b>');
    expect(r.ok).toBe(false);
    expect(r.formatted).toBeUndefined();
    expect(r.errors[0]).toMatchObject({ line: 1, column: 4 });
  });
});

describe('minifyXml', () => {
  it('collapses formatted XML back to one line, preserving structures', () => {
    const formatted = '<?xml version="1.0"?>\n<root>\n  <a>1</a>\n  <!-- c -->\n</root>';
    const r = minifyXml(formatted);
    expect(r.ok).toBe(true);
    expect(r.formatted).toBe('<?xml version="1.0"?><root><a>1</a><!-- c --></root>');
  });
});

describe('parseXmlTree', () => {
  it('returns null for invalid XML', () => {
    expect(parseXmlTree('<a></b>')).toBeNull();
  });

  it('builds elements with attributes, text, comment, and CDATA', () => {
    const tree = parseXmlTree('<root a="1"><child>hi</child><!-- c --><d><![CDATA[z]]></d></root>');
    const root = tree?.[0];
    if (!root || root.type !== 'element') throw new Error('expected a root element');
    expect(root.name).toBe('root');
    expect(root.attributes).toEqual([['a', '1']]);
    const kinds = root.children.map((c) => c.type);
    expect(kinds).toContain('element');
    expect(kinds).toContain('comment');
  });
});
