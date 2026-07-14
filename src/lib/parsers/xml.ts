import { XMLValidator, XMLParser } from 'fast-xml-parser';
import xmlFormat from 'xml-formatter';
import type { ParseIssue, ParseResult } from './types';
import { byteLength } from '@/lib/utils/bytes';

export type XmlIndent = 2 | 4 | 'tab';

function indentString(indent: XmlIndent): string {
  if (indent === 'tab') return '\t';
  return ' '.repeat(indent);
}

function makeStats(text: string, parseMs: number): ParseResult['stats'] {
  return {
    bytes: byteLength(text),
    lines: text.length === 0 ? 0 : text.split('\n').length,
    parseMs,
  };
}

function cleanMessage(msg: string): string {
  const trimmed = msg.trim();
  const withDot = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return withDot.charAt(0).toUpperCase() + withDot.slice(1);
}

/**
 * Well-formedness validation via fast-xml-parser's XMLValidator. This checks structure
 * (matched tags, quoted attributes, legal characters) — NOT schema/XSD validity.
 */
export function validateXml(input: string): ParseResult {
  const start = performance.now();
  if (input.trim().length === 0) {
    return { ok: false, errors: [], stats: makeStats(input, 0) };
  }
  const outcome = XMLValidator.validate(input, { allowBooleanAttributes: false });
  if (outcome === true) {
    return { ok: true, errors: [], stats: makeStats(input, performance.now() - start) };
  }
  const err = outcome.err;
  const issue: ParseIssue = {
    line: err.line ?? 1,
    column: err.col ?? 1,
    message: cleanMessage(err.msg),
    severity: 'error',
  };
  return { ok: false, errors: [issue], stats: makeStats(input, performance.now() - start) };
}

/** Pretty-print XML (preserves declaration, comments, CDATA). Validates first. */
export function formatXml(input: string, indent: XmlIndent = 2): ParseResult {
  const start = performance.now();
  const validation = validateXml(input);
  if (!validation.ok) return validation;
  try {
    const formatted = xmlFormat(input, {
      indentation: indentString(indent),
      lineSeparator: '\n',
      collapseContent: true,
      throwOnFailure: true,
    });
    return {
      ok: true,
      formatted,
      errors: [],
      stats: makeStats(input, performance.now() - start),
    };
  } catch (e) {
    return {
      ok: false,
      errors: [{ line: 1, column: 1, message: cleanMessage(String(e)), severity: 'error' }],
      stats: makeStats(input, performance.now() - start),
    };
  }
}

/** Minify XML (preserves declaration, comments, CDATA). Validates first. */
export function minifyXml(input: string): ParseResult {
  const start = performance.now();
  const validation = validateXml(input);
  if (!validation.ok) return validation;
  try {
    const formatted = xmlFormat.minify(input, { collapseContent: true });
    return {
      ok: true,
      formatted,
      errors: [],
      stats: makeStats(input, performance.now() - start),
    };
  } catch (e) {
    return {
      ok: false,
      errors: [{ line: 1, column: 1, message: cleanMessage(String(e)), severity: 'error' }],
      stats: makeStats(input, performance.now() - start),
    };
  }
}

// ---- Tree model ---------------------------------------------------------------

export type XmlNode =
  | { type: 'element'; name: string; attributes: Array<[string, string]>; children: XmlNode[] }
  | { type: 'text'; value: string }
  | { type: 'cdata'; value: string }
  | { type: 'comment'; value: string };

const ATTR_PREFIX = '@_';

function extractText(children: unknown): string {
  if (!Array.isArray(children)) return '';
  return children
    .map((c) => (c && typeof c === 'object' && '#text' in c ? String((c as Record<string, unknown>)['#text']) : ''))
    .join('');
}

function convertEntry(entry: Record<string, unknown>): XmlNode | null {
  if ('#text' in entry) {
    const value = String(entry['#text']);
    if (value.trim().length === 0) return null; // drop whitespace-only text nodes
    return { type: 'text', value };
  }
  if ('#comment' in entry) {
    return { type: 'comment', value: extractText(entry['#comment']).trim() };
  }
  if ('#cdata' in entry) {
    return { type: 'cdata', value: extractText(entry['#cdata']) };
  }

  const name = Object.keys(entry).find((k) => k !== ':@');
  if (!name) return null;

  const attrsRaw = (entry[':@'] as Record<string, unknown> | undefined) ?? {};
  const attributes: Array<[string, string]> = Object.entries(attrsRaw).map(([k, v]) => [
    k.startsWith(ATTR_PREFIX) ? k.slice(ATTR_PREFIX.length) : k,
    String(v),
  ]);

  const rawChildren = entry[name];
  const children = Array.isArray(rawChildren)
    ? rawChildren
        .map((c) => convertEntry(c as Record<string, unknown>))
        .filter((n): n is XmlNode => n !== null)
    : [];

  return { type: 'element', name, attributes, children };
}

/** Parse well-formed XML into a tree of elements/attributes/text/comments/CDATA. */
export function parseXmlTree(input: string): XmlNode[] | null {
  if (validateXml(input).ok === false) return null;
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    preserveOrder: true,
    commentPropName: '#comment',
    cdataPropName: '#cdata',
    parseTagValue: false,
    trimValues: false,
  });
  const parsed = parser.parse(input) as Array<Record<string, unknown>>;
  return parsed.map((e) => convertEntry(e)).filter((n): n is XmlNode => n !== null);
}
