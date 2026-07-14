'use client';

import { useEffect, useRef, useState } from 'react';
import { CodeEditor, type CodeEditorHandle } from '@/components/editor/CodeEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { SplitPane } from '@/components/panels/SplitPane';
import { StatusSpine } from '@/components/panels/StatusSpine';
import { ErrorPanel } from '@/components/panels/ErrorPanel';
import { JsonTree } from './JsonTree';
import { useToast } from '@/components/ui/ToastProvider';
import { JsonProcessor } from '@/lib/workers/jsonClient';
import { validateJson } from '@/lib/parsers/json';
import { verdictFor, type ParseResult, type Verdict } from '@/lib/parsers/types';
import { JSON_SAMPLE } from '@/lib/samples/json';

type Indent = 2 | 4 | 'tab';
type OutputMode = 'format' | 'minify';
type Tab = 'output' | 'tree';
type Json = Parameters<typeof JSON.stringify>[0];

const PLACEHOLDER = 'Paste JSON here, or load a sample.';

export function JsonTool() {
  const { toast } = useToast();
  const editorRef = useRef<CodeEditorHandle>(null);
  const processorRef = useRef<JsonProcessor | null>(null);
  if (processorRef.current === null) processorRef.current = new JsonProcessor();
  const reqRef = useRef(0);

  const [input, setInput] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [verdict, setVerdict] = useState<Verdict>('idle');
  const [output, setOutput] = useState('');
  const [parsed, setParsed] = useState<Json>(undefined);
  const [indent, setIndent] = useState<Indent>(2);
  const [outputMode, setOutputMode] = useState<OutputMode>('format');
  const [tab, setTab] = useState<Tab>('output');
  const [treeAllOpen, setTreeAllOpen] = useState(true);
  const [treeReset, setTreeReset] = useState(0);

  const errors = result?.errors ?? [];

  // Debounced live validation (spec §9: 300 ms).
  useEffect(() => {
    const handle = window.setTimeout(() => {
      void revalidate(input, indent, outputMode);
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, indent, outputMode]);

  async function revalidate(text: string, ind: Indent, mode: OutputMode) {
    const processor = processorRef.current!;
    const req = ++reqRef.current;

    if (text.trim().length === 0) {
      setResult(null);
      setVerdict('idle');
      setOutput('');
      setParsed(undefined);
      return;
    }

    if (processor.usesWorker(text)) setVerdict('working');

    const validation = await processor.process({ op: 'validate', input: text });
    if (req !== reqRef.current) return; // superseded by a newer keystroke

    setResult(validation);
    setVerdict(verdictFor(validation));

    if (!validation.ok) {
      setParsed(undefined);
      return;
    }

    try {
      setParsed(JSON.parse(text) as Json);
    } catch {
      setParsed(undefined);
    }

    const job =
      mode === 'minify'
        ? ({ op: 'minify', input: text } as const)
        : ({ op: 'format', input: text, options: { indent: ind } } as const);
    const produced = await processor.process(job);
    if (req !== reqRef.current) return;
    if (produced.ok && produced.formatted != null) setOutput(produced.formatted);
  }

  function handleValidate() {
    if (input.trim().length === 0) {
      toast('Nothing to validate', 'warn');
      return;
    }
    void revalidate(input, indent, outputMode);
    // Large inputs validate in the worker; small inputs report synchronously so the
    // toast reflects the current text rather than the previous debounce.
    if (processorRef.current!.usesWorker(input)) {
      toast('Validating…', 'neutral');
      return;
    }
    const r = validateJson(input);
    toast(
      r.ok ? 'Valid JSON' : `${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`,
      r.ok ? 'valid' : 'invalid',
    );
  }

  function handleFormat() {
    if (input.trim().length === 0) return toast('Nothing to format', 'warn');
    setOutputMode('format');
    setTab('output');
    toast('Formatted', 'valid');
  }

  function handleMinify() {
    if (input.trim().length === 0) return toast('Nothing to minify', 'warn');
    setOutputMode('minify');
    setTab('output');
    toast('Minified', 'valid');
  }

  function loadText(text: string) {
    setInput(text);
    setTab('output');
  }

  function handleClear() {
    setInput('');
    setOutput('');
    setResult(null);
    setParsed(undefined);
    setVerdict('idle');
  }

  const summary =
    verdict === 'valid'
      ? `Valid JSON — ${result?.stats?.lines ?? 0} lines`
      : verdict === 'invalid'
        ? `${errors.length} error${errors.length === 1 ? '' : 's'} found${
            errors[0] ? `, first at line ${errors[0].line}` : ''
          }`
        : verdict === 'working'
          ? 'Validating…'
          : 'Ready';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <EditorToolbar
          onInsertText={loadText}
          onValidate={handleValidate}
          onFormat={handleFormat}
          onMinify={handleMinify}
          onClear={handleClear}
          output={output}
          sample={JSON_SAMPLE}
          downloadName={outputMode === 'minify' ? 'data.min.json' : 'data.json'}
          downloadMime="application/json"
        />
        <label className="flex items-center gap-1.5 font-mono text-label text-muted">
          Indent
          <select
            value={String(indent)}
            onChange={(e) =>
              setIndent(e.target.value === 'tab' ? 'tab' : (Number(e.target.value) as Indent))
            }
            className="rounded border border-border bg-surface px-1.5 py-1 text-ink"
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </label>
      </div>

      <div className="flex min-h-[440px] items-stretch gap-3">
        <StatusSpine verdict={verdict} summary={summary} />
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <SplitPane
            leftLabel="JSON input"
            rightLabel="Output and tree"
            left={
              <div className="flex h-full flex-col overflow-hidden rounded-md border border-border">
                <div className="border-b border-border px-3 py-1.5 font-mono text-label text-muted">
                  Input
                </div>
                <div className="min-h-0 flex-1">
                  <CodeEditor
                    ref={editorRef}
                    value={input}
                    onChange={setInput}
                    language="json"
                    errors={errors}
                    placeholder={PLACEHOLDER}
                    ariaLabel="JSON input editor"
                    onValidate={handleValidate}
                    onFormat={handleFormat}
                  />
                </div>
              </div>
            }
            right={
              <div className="flex h-full flex-col overflow-hidden rounded-md border border-border">
                <div
                  role="tablist"
                  aria-label="Output view"
                  className="flex items-center gap-1 border-b border-border px-2 py-1"
                >
                  {(['output', 'tree'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={
                        'rounded px-2.5 py-1 font-mono text-label capitalize transition-colors duration-fade ' +
                        (tab === t ? 'bg-accent/10 text-accent' : 'text-muted hover:text-ink')
                      }
                    >
                      {t}
                    </button>
                  ))}
                  {tab === 'tree' && parsed !== undefined && (
                    <div className="ml-auto flex gap-1">
                      <button
                        onClick={() => {
                          setTreeAllOpen(true);
                          setTreeReset((n) => n + 1);
                        }}
                        className="rounded border border-border px-2 py-0.5 font-mono text-label text-muted hover:text-ink"
                      >
                        Expand all
                      </button>
                      <button
                        onClick={() => {
                          setTreeAllOpen(false);
                          setTreeReset((n) => n + 1);
                        }}
                        className="rounded border border-border px-2 py-0.5 font-mono text-label text-muted hover:text-ink"
                      >
                        Collapse all
                      </button>
                    </div>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                  {tab === 'output' ? (
                    output ? (
                      <CodeEditor
                        value={output}
                        language="json"
                        readOnly
                        ariaLabel="Formatted JSON output"
                      />
                    ) : (
                      <p className="p-3 font-mono text-label text-muted">
                        Valid JSON will appear here, formatted.
                      </p>
                    )
                  ) : parsed !== undefined ? (
                    <div className="p-3">
                      <JsonTree value={parsed} resetSignal={treeReset} defaultOpen={treeAllOpen} />
                    </div>
                  ) : (
                    <p className="p-3 font-mono text-label text-muted">
                      Fix the errors to explore the tree.
                    </p>
                  )}
                </div>
              </div>
            }
          />

          <div className="rounded-md border border-border bg-surface">
            <ErrorPanel
              result={result}
              subject="JSON"
              onSelect={(issue) => editorRef.current?.scrollToLine(issue.line, issue.column)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
