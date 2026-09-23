'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditor, type CodeEditorHandle } from '@/components/editor/CodeEditor';
import { SplitPane } from '@/components/panels/SplitPane';
import { VSplitPane } from '@/components/panels/VSplitPane';
import { StatusSpine } from '@/components/panels/StatusSpine';
import { ErrorPanel } from '@/components/panels/ErrorPanel';
import { MarkdownPreview } from './MarkdownPreview';
import { MarkdownToolbar } from './MarkdownToolbar';
import { MarkdownProcessor } from '@/lib/workers/markdownClient';
import { markdownStats } from '@/lib/markdown/stats';
import { type ParseResult, type Verdict } from '@/lib/parsers/types';
import { MARKDOWN_SAMPLE } from '@/lib/samples/markdown';

export function MarkdownTool() {
  const editorRef = useRef<CodeEditorHandle>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const processorRef = useRef<MarkdownProcessor | null>(null);
  if (processorRef.current === null) processorRef.current = new MarkdownProcessor();
  const reqRef = useRef(0);

  const [input, setInput] = useState('');
  const [previewSource, setPreviewSource] = useState('');
  const [lint, setLint] = useState<ParseResult | null>(null);
  const [verdict, setVerdict] = useState<Verdict>('idle');
  // Once a document arrives (paste/upload/sample), the editor folds away so the
  // preview gets the full width; typing never auto-collapses (it would steal focus).
  const [editorCollapsed, setEditorCollapsed] = useState(false);

  function handleBulkInsert(text: string) {
    setInput(text);
    if (text.trim().length > 0) setEditorCollapsed(true);
  }

  const stats = useMemo(() => markdownStats(input), [input]);
  const warnings = lint?.errors ?? [];

  // Live preview — debounced 150 ms (spec §7.3).
  useEffect(() => {
    const handle = window.setTimeout(() => setPreviewSource(input), 150);
    return () => window.clearTimeout(handle);
  }, [input]);

  // Lint — debounced 300 ms.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runLint(input);
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  async function runLint(text: string) {
    const processor = processorRef.current!;
    const req = ++reqRef.current;

    if (text.trim().length === 0) {
      setLint(null);
      setVerdict('idle');
      return;
    }
    if (processor.usesWorker(text)) setVerdict('working');

    const result = await processor.lint(text);
    if (req !== reqRef.current) return;
    setLint(result);
    setVerdict(result.errors.length > 0 ? 'warnings' : 'valid');
  }

  function syncPreviewScroll(ratio: number) {
    const el = previewRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = ratio * max;
  }

  const summary =
    verdict === 'warnings'
      ? `${warnings.length} lint warning${warnings.length === 1 ? '' : 's'}`
      : verdict === 'valid'
        ? 'No lint warnings'
        : verdict === 'working'
          ? 'Linting…'
          : 'Ready';

  return (
    <div className="flex flex-col gap-3">
      <MarkdownToolbar
        source={input}
        onInsertText={handleBulkInsert}
        onClear={() => {
          setInput('');
          setEditorCollapsed(false);
        }}
        sample={MARKDOWN_SAMPLE}
        stats={stats}
      />

      <div className="flex h-[min(70vh,720px)] min-h-[440px] items-stretch gap-3">
        <StatusSpine verdict={verdict} summary={summary} />
        <div className="flex min-h-0 flex-1 flex-col">
          <VSplitPane
            topLabel="Editor and preview"
            bottomLabel="Lint warnings"
            top={
              editorCollapsed ? (
                <div className="flex min-h-0 flex-1 items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorCollapsed(false)}
                    aria-expanded={false}
                    aria-label="Expand editor"
                    title="Expand editor"
                    className="flex w-9 shrink-0 flex-col items-center justify-center gap-3 rounded-md border border-border bg-surface text-muted transition-colors duration-fade hover:border-accent hover:text-accent"
                  >
                    <span aria-hidden="true">»</span>
                    <span className="font-mono text-label [writing-mode:vertical-rl]">Editor</span>
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border">
                    <div className="border-b border-border px-3 py-1.5 font-mono text-label text-muted">
                      Preview
                    </div>
                    <div className="min-h-0 flex-1">
                      <MarkdownPreview ref={previewRef} source={previewSource} />
                    </div>
                  </div>
                </div>
              ) : (
                <SplitPane
                  leftLabel="Markdown editor"
                  rightLabel="Rendered preview"
                  left={
                    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border">
                      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 font-mono text-label text-muted">
                        Editor
                        <button
                          type="button"
                          onClick={() => setEditorCollapsed(true)}
                          aria-label="Collapse editor to widen the preview"
                          title="Collapse editor to widen the preview"
                          className="rounded border border-border px-1.5 leading-tight transition-colors duration-fade hover:border-accent hover:text-accent"
                        >
                          «
                        </button>
                      </div>
                      <div className="min-h-0 flex-1">
                        <CodeEditor
                          ref={editorRef}
                          value={input}
                          onChange={setInput}
                          language="markdown"
                          errors={warnings}
                          placeholder="Write Markdown here, or load a sample."
                          ariaLabel="Markdown editor"
                          onScrollRatio={syncPreviewScroll}
                        />
                      </div>
                    </div>
                  }
                  right={
                    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border">
                      <div className="border-b border-border px-3 py-1.5 font-mono text-label text-muted">
                        Preview
                      </div>
                      <div className="min-h-0 flex-1">
                        <MarkdownPreview ref={previewRef} source={previewSource} />
                      </div>
                    </div>
                  }
                />
              )
            }
            bottom={
              <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-surface">
                <ErrorPanel
                  result={lint}
                  subject="Markdown"
                  okLabel="No lint warnings"
                  onSelect={(issue) => editorRef.current?.scrollToLine(issue.line, issue.column)}
                />
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
