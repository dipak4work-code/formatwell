import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

/**
 * "Ink & Signal" editor theme. Colors reference the CSS variables defined in
 * globals.css, so a single theme adapts to both light and dark automatically.
 */
const inkTheme = EditorView.theme({
  '&': {
    color: 'var(--ink)',
    backgroundColor: 'var(--surface)',
    fontSize: '13px',
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono), ui-monospace, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': {
    caretColor: 'var(--accent)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 24%, transparent)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--surface)',
    color: 'var(--muted)',
    border: 'none',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)',
    color: 'var(--ink)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)',
  },
  '.cm-line.cm-errorLine': {
    backgroundColor: 'color-mix(in srgb, var(--invalid) 13%, transparent)',
    boxShadow: 'inset 3px 0 0 0 var(--invalid)',
  },
  '.cm-line.cm-warnLine': {
    backgroundColor: 'color-mix(in srgb, var(--warn) 12%, transparent)',
    boxShadow: 'inset 3px 0 0 0 var(--warn)',
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--invalid)',
    textDecorationSkipInk: 'none',
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--warn)',
    textDecorationSkipInk: 'none',
  },
  '.cm-lint-marker-error': { content: '""' },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--ink)',
    borderRadius: '6px',
  },
  '.cm-tooltip-lint': {
    padding: '4px 8px',
    fontFamily: 'var(--font-sans), sans-serif',
  },
  '&.cm-editor.cm-focused': {
    outline: 'none',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
  },
});

const inkHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--accent)' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--ink)', fontWeight: '500' },
  { tag: [t.string, t.special(t.string)], color: 'var(--valid)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--warn)' },
  { tag: [t.tagName, t.angleBracket], color: 'var(--accent)' },
  { tag: [t.attributeName], color: 'var(--ink)', fontWeight: '500' },
  { tag: [t.attributeValue], color: 'var(--valid)' },
  { tag: [t.comment, t.blockComment, t.lineComment], color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [t.heading], color: 'var(--ink)', fontWeight: '700' },
  { tag: [t.emphasis], fontStyle: 'italic' },
  { tag: [t.strong], fontWeight: '700' },
  { tag: [t.link, t.url], color: 'var(--accent)', textDecoration: 'underline' },
  { tag: [t.monospace], color: 'var(--ink)' },
  { tag: [t.punctuation, t.separator, t.bracket], color: 'var(--muted)' },
  { tag: [t.invalid], color: 'var(--invalid)' },
]);

export const inkSignalTheme: Extension = [inkTheme, syntaxHighlighting(inkHighlight)];
