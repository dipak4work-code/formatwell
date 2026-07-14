'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { EditorView, keymap, Decoration, type DecorationSet } from '@codemirror/view';
import {
  EditorState,
  Compartment,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { indentWithTab } from '@codemirror/commands';
import { setDiagnostics, lintGutter, type Diagnostic } from '@codemirror/lint';
import { inkSignalTheme } from './theme';
import type { ParseIssue, Severity } from '@/lib/parsers/types';

// Full-line highlight for the line where parsing failed, so it's obvious at a glance.
const setErrorLines = StateEffect.define<Array<{ line: number; severity: Severity }>>();
const errorLineDeco = Decoration.line({ class: 'cm-errorLine' });
const warnLineDeco = Decoration.line({ class: 'cm-warnLine' });

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLines)) continue;
      // Dedupe by line; an error outranks a warning on the same line.
      const byLine = new Map<number, Severity>();
      for (const { line, severity } of effect.value) {
        const lineNo = Math.min(Math.max(line, 1), tr.state.doc.lines);
        if (byLine.get(lineNo) !== 'error') byLine.set(lineNo, severity);
      }
      const ranges = [...byLine.entries()]
        .map(([lineNo, severity]) => {
          const from = tr.state.doc.line(lineNo).from;
          return (severity === 'warning' ? warnLineDeco : errorLineDeco).range(from);
        })
        .sort((a, b) => a.from - b.from);
      deco = Decoration.set(ranges);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export type EditorLanguage = 'json' | 'xml' | 'markdown';

export interface CodeEditorHandle {
  /** Move the cursor to a 1-based line (and optional 1-based column) and scroll to it. */
  scrollToLine: (line: number, column?: number) => void;
  focus: () => void;
}

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: EditorLanguage;
  errors?: ParseIssue[];
  readOnly?: boolean;
  placeholder?: string;
  /** Ctrl/Cmd+Enter */
  onValidate?: () => void;
  /** Ctrl/Cmd+Shift+F */
  onFormat?: () => void;
  /** Reports vertical scroll position as a 0–1 ratio (for preview sync). */
  onScrollRatio?: (ratio: number) => void;
  ariaLabel?: string;
}

/** Lazy-load the matching CodeMirror language pack so it stays out of the shared bundle. */
async function loadLanguage(language: EditorLanguage): Promise<Extension> {
  switch (language) {
    case 'json':
      return (await import('@codemirror/lang-json')).json();
    case 'xml':
      return (await import('@codemirror/lang-xml')).xml();
    case 'markdown':
      return (await import('@codemirror/lang-markdown')).markdown();
  }
}

function toDiagnostics(view: EditorView, issues: ParseIssue[]): Diagnostic[] {
  const doc = view.state.doc;
  return issues.map((issue) => {
    const lineNo = Math.min(Math.max(issue.line, 1), doc.lines);
    const line = doc.line(lineNo);
    const from = Math.min(line.from + Math.max(issue.column - 1, 0), line.to);
    // Underline from the error column to the end of the line so the failing span is visible.
    const to = from < line.to ? line.to : Math.min(from + 1, doc.length);
    return {
      from,
      to,
      severity: issue.severity,
      message: issue.message,
    };
  });
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    value,
    onChange,
    language,
    errors = [],
    readOnly = false,
    placeholder,
    onValidate,
    onFormat,
    onScrollRatio,
    ariaLabel,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageConf = useRef(new Compartment());
  const readOnlyConf = useRef(new Compartment());

  // Keep latest callbacks/props in refs so the editor is created once (no teardown churn).
  const onChangeRef = useRef(onChange);
  const onValidateRef = useRef(onValidate);
  const onFormatRef = useRef(onFormat);
  const onScrollRatioRef = useRef(onScrollRatio);
  onChangeRef.current = onChange;
  onValidateRef.current = onValidate;
  onFormatRef.current = onFormat;
  onScrollRatioRef.current = onScrollRatio;

  useImperativeHandle(ref, () => ({
    scrollToLine(lineNo: number, column = 1) {
      const view = viewRef.current;
      if (!view) return;
      const clamped = Math.min(Math.max(lineNo, 1), view.state.doc.lines);
      const line = view.state.doc.line(clamped);
      const pos = Math.min(line.from + Math.max(column - 1, 0), line.to);
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        scrollIntoView: true,
      });
      view.focus();
    },
    focus() {
      viewRef.current?.focus();
    },
  }));

  // Create the editor once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const appKeymap = keymap.of([
      {
        key: 'Mod-Enter',
        preventDefault: true,
        run: () => {
          onValidateRef.current?.();
          return true;
        },
      },
      {
        key: 'Mod-Shift-f',
        preventDefault: true,
        run: () => {
          onFormatRef.current?.();
          return true;
        },
      },
      indentWithTab,
    ]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        lintGutter(),
        errorLineField,
        appKeymap,
        inkSignalTheme,
        EditorView.lineWrapping,
        languageConf.current.of([]),
        readOnlyConf.current.of([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
        EditorView.contentAttributes.of({
          'aria-label': ariaLabel ?? 'Code editor',
          ...(placeholder ? { 'aria-placeholder': placeholder } : {}),
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

    const scroller = view.scrollDOM;
    const handleScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      onScrollRatioRef.current?.(max > 0 ? scroller.scrollTop / max : 0);
    };
    scroller.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally create once; other props sync via dedicated effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load / swap the language extension.
  useEffect(() => {
    let cancelled = false;
    loadLanguage(language).then((ext) => {
      if (cancelled) return;
      viewRef.current?.dispatch({ effects: languageConf.current.reconfigure(ext) });
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Sync readOnly.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyConf.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  // Sync external value changes (e.g. Format, Sample, Clear) without clobbering typing.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Sync diagnostics + full-line error highlight.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, toDiagnostics(view, errors)));
    view.dispatch({
      effects: setErrorLines.of(errors.map((e) => ({ line: e.line, severity: e.severity }))),
    });
  }, [errors]);

  return <div ref={hostRef} className="h-full min-h-0 overflow-hidden" />;
});
