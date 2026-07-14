'use client';

import { useEffect, useRef, useState } from 'react';
import { CodeEditor, type CodeEditorHandle } from '@/components/editor/CodeEditor';
import { JsonlToolbar } from './JsonlToolbar';
import { SplitPane } from '@/components/panels/SplitPane';
import { StatusSpine } from '@/components/panels/StatusSpine';
import { ErrorPanel } from '@/components/panels/ErrorPanel';
import { JsonTree } from '@/components/json/JsonTree';
import { useToast } from '@/components/ui/ToastProvider';
import { JsonlProcessor } from '@/lib/workers/jsonlClient';
import { arrayToJsonl, parseJsonlRecords, validateJsonl, type JsonlIndent } from '@/lib/parsers/jsonl';
import { verdictFor, type ParseResult, type Verdict } from '@/lib/parsers/types';
import { JSONL_SAMPLE } from '@/lib/samples/jsonl';

type OutputMode = 'jsonl' | 'array';
type Tab = 'output' | 'tree';
type Json = Parameters<typeof JSON.stringify>[0];

const PLACEHOLDER = 'Paste JSONL here (one JSON value per line), or load a sample.';

export function JsonlTool() {
  const { toast } = useToast();
  const editorRef = useRef<CodeEditorHandle>(null);
  const processorRef = useRef<JsonlProcessor | null>(null);
  if (processorRef.current === null) processorRef.current = new JsonlProcessor();
  const reqRef = useRef(0);

  const [input, setInput] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [verdict, setVerdict] = useState<Verdict>('idle');
  const [output, setOutput] = useState('');
  const [records, setRecords] = useState<Json>(undefined);
  const [indent, setIndent] = useState<JsonlIndent>(2);
  const [outputMode, setOutputMode] = useState<OutputMode>('jsonl');
  const [tab, setTab] = useState<Tab>('output');
  const [treeAllOpen, setTreeAllOpen] = useState(true);
  const [treeReset, setTreeReset] = useState(0);

  const errors = result?.errors ?? [];

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void revalidate(input, indent, outputMode);
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, indent, outputMode]);

  async function revalidate(text: string, ind: JsonlIndent, mode: OutputMode) {
    const processor = processorRef.current!;
    const req = ++reqRef.current;

    if (text.trim().length === 0) {
      setResult(null);
      setVerdict('idle');
      setOutput('');
      setRecords(undefined);
      return;
    }

    if (processor.usesWorker(text)) setVerdict('working');

    const validation = await processor.process({ op: 'validate', input: text });
    if (req !== reqRef.current) return;

    setResult(validation);
    setVerdict(verdictFor(validation));

    if (!validation.ok) {
      setRecords(undefined);
      return;
    }

    setRecords(parseJsonlRecords(text) as Json);

    const produced = await processor.process(
      mode === 'array' ? { op: 'toArray', input: text, indent: ind } : { op: 'minify', input: text },
    );
    if (req !== reqRef.current) return;
    if (produced.ok && produced.formatted != null) setOutput(produced.formatted);
  }

  function handleValidate() {
    if (input.trim().length === 0) {
      toast('Nothing to validate', 'warn');
      return;
    }
    void revalidate(input, indent, outputMode);
    if (processorRef.current!.usesWorker(input)) {
      toast('Validating…', 'neutral');
      return;
    }
    const r = validateJsonl(input);
    toast(
      r.ok
        ? `Valid JSONL — ${r.stats?.records ?? 0} record${r.stats?.records === 1 ? '' : 's'}`
        : `${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`,
      r.ok ? 'valid' : 'invalid',
    );
  }

  function handleMinify() {
    if (input.trim().length === 0) return toast('Nothing to minify', 'warn');
    setOutputMode('jsonl');
    setTab('output');
    toast('Minified', 'valid');
  }

  function handleToArray() {
    if (input.trim().length === 0) return toast('Nothing to convert', 'warn');
    setOutputMode('array');
    setTab('output');
    toast('Converted to JSON array', 'valid');
  }

  function handleFromArray() {
    if (input.trim().length === 0) return toast('Nothing to convert', 'warn');
    const r = arrayToJsonl(input);
    if (r.ok && r.formatted != null) {
      setInput(r.formatted);
      setOutputMode('jsonl');
      setTab('output');
      toast('Converted array to JSONL', 'valid');
    } else {
      setResult(r);
      setVerdict('invalid');
      toast(r.errors[0]?.message ?? 'Not a JSON array', 'invalid');
    }
  }

  function loadText(text: string) {
    setInput(text);
    setTab('output');
  }

  function handleClear() {
    setInput('');
    setOutput('');
    setResult(null);
    setRecords(undefined);
    setVerdict('idle');
  }

  const summary =
    verdict === 'valid'
      ? `Valid JSONL — ${result?.stats?.records ?? 0} records`
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
        <JsonlToolbar
          onInsertText={loadText}
          onValidate={handleValidate}
          onMinify={handleMinify}
          onToArray={handleToArray}
          onFromArray={handleFromArray}
          onClear={handleClear}
          output={output}
          sample={JSONL_SAMPLE}
          downloadName={outputMode === 'array' ? 'data.json' : 'data.jsonl'}
          downloadMime={outputMode === 'array' ? 'application/json' : 'application/x-ndjson'}
        />
        {outputMode === 'array' && (
          <label className="flex items-center gap-1.5 font-mono text-label text-muted">
            Indent
            <select
              value={String(indent)}
              onChange={(e) =>
                setIndent(e.target.value === 'tab' ? 'tab' : (Number(e.target.value) as JsonlIndent))
              }
              className="rounded border border-border bg-surface px-1.5 py-1 text-ink"
            >
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="tab">Tab</option>
            </select>
          </label>
        )}
      </div>

      <div className="flex min-h-[440px] items-stretch gap-3">
        <StatusSpine verdict={verdict} summary={summary} />
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <SplitPane
            leftLabel="JSONL input"
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
                    ariaLabel="JSONL input editor"
                    onValidate={handleValidate}
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
                      {t === 'output' ? `output (${outputMode === 'array' ? 'array' : 'jsonl'})` : 'tree'}
                    </button>
                  ))}
                  {tab === 'tree' && records !== undefined && (
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
                        ariaLabel="JSONL output"
                      />
                    ) : (
                      <p className="p-3 font-mono text-label text-muted">
                        Valid JSONL will appear here.
                      </p>
                    )
                  ) : records !== undefined ? (
                    <div className="p-3">
                      <JsonTree value={records} resetSignal={treeReset} defaultOpen={treeAllOpen} />
                    </div>
                  ) : (
                    <p className="p-3 font-mono text-label text-muted">
                      Fix the errors to explore the records.
                    </p>
                  )}
                </div>
              </div>
            }
          />

          <div className="rounded-md border border-border bg-surface">
            <ErrorPanel
              result={result}
              subject="JSONL"
              onSelect={(issue) => editorRef.current?.scrollToLine(issue.line, issue.column)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
