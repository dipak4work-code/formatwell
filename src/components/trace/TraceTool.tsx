'use client';

import { useEffect, useRef, useState } from 'react';
import { StatusSpine } from '@/components/panels/StatusSpine';
import { ErrorPanel } from '@/components/panels/ErrorPanel';
import { ToolButton } from '@/components/ui/ToolButton';
import { useToast } from '@/components/ui/ToastProvider';
import { TraceTimeline } from './TraceTimeline';
import { TraceGraphView } from './graph/TraceGraph';
import { NodeDetail } from './graph/NodeDetail';
import type { GraphNode } from './graph/layout';
import { TraceProcessor } from '@/lib/workers/traceClient';
import type { TraceSession } from '@/lib/parsers/agentTrace';
import { verdictFor, type ParseResult, type Verdict } from '@/lib/parsers/types';
import { readClipboard, readTextFile } from '@/lib/utils/io';
import { AGENT_TRACE_SAMPLE } from '@/lib/samples/agentTrace';

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(first?: string, last?: string): string {
  if (!first || !last) return '—';
  const ms = new Date(last).getTime() - new Date(first).getTime();
  if (!isFinite(ms) || ms < 0) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return `${Math.round(ms / 1000)}s`;
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'invalid' }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`font-mono text-section font-600 ${tone === 'invalid' ? 'text-invalid' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  );
}

export function TraceTool() {
  const { toast } = useToast();
  const processorRef = useRef<TraceProcessor | null>(null);
  if (processorRef.current === null) processorRef.current = new TraceProcessor();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reqRef = useRef(0);

  const [result, setResult] = useState<ParseResult | null>(null);
  const [trace, setTrace] = useState<TraceSession | null>(null);
  const [verdict, setVerdict] = useState<Verdict>('idle');
  const [showMeta, setShowMeta] = useState(false);
  const [sourceName, setSourceName] = useState<string>('');
  const [view, setView] = useState<'graph' | 'timeline'>('graph');
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [fitKey, setFitKey] = useState(0);

  // Live watch (File System Access API, Chromium only).
  const [watching, setWatching] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const watchRef = useRef<{
    handle: FileSystemFileHandle;
    timer: number;
    lastModified: number;
    lastSize: number;
    busy: boolean;
  } | null>(null);

  const canWatch = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  // Stop polling on unmount.
  useEffect(() => {
    return () => {
      if (watchRef.current) window.clearInterval(watchRef.current.timer);
    };
  }, []);

  async function load(text: string, name: string, opts: { live?: boolean } = {}) {
    const req = ++reqRef.current;
    setSourceName(name);
    if (!opts.live) {
      stopWatch(false);
      setSelected(null);
    }
    setVerdict('working');
    const out = await processorRef.current!.process(text);
    if (req !== reqRef.current) return;
    setResult(out.result);
    setTrace(out.trace);
    setVerdict(verdictFor(out.result));
    setLastUpdate(new Date().toLocaleTimeString([], { hour12: false }));
    if (!opts.live) setFitKey((k) => k + 1);
    if (opts.live) return; // quiet updates while watching
    if (out.result.ok && out.trace) {
      toast(
        `Parsed ${out.trace.meta.userTurns + out.trace.meta.assistantTurns} turns, ${out.trace.meta.toolCalls} tool calls`,
        'valid',
      );
    } else if (out.result.errors.length > 0) {
      toast(out.result.errors[0]!.message, 'invalid');
    }
  }

  function stopWatch(announce = true) {
    const w = watchRef.current;
    if (!w) return;
    window.clearInterval(w.timer);
    watchRef.current = null;
    setWatching(null);
    if (announce) toast('Stopped watching', 'neutral');
  }

  async function startWatch() {
    if (!canWatch || !window.showOpenFilePicker) {
      toast('Live watch needs Chrome or Edge', 'warn');
      return;
    }
    let handle: FileSystemFileHandle;
    try {
      const picked = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Session transcript',
            accept: { 'text/plain': ['.jsonl', '.ndjson', '.txt'] },
          },
        ],
      });
      if (!picked[0]) return;
      handle = picked[0];
    } catch {
      return; // user cancelled the picker
    }

    stopWatch(false);
    const file = await handle.getFile();
    const text = await file.text();
    await load(text, file.name);

    const timer = window.setInterval(async () => {
      const w = watchRef.current;
      if (!w || w.busy) return;
      w.busy = true;
      try {
        const f = await w.handle.getFile();
        if (f.lastModified !== w.lastModified || f.size !== w.lastSize) {
          w.lastModified = f.lastModified;
          w.lastSize = f.size;
          await load(await f.text(), f.name, { live: true });
        }
      } catch {
        // File became unreadable (deleted/moved) — stop cleanly.
        stopWatch(false);
        toast('Lost access to the watched file', 'warn');
      } finally {
        const w2 = watchRef.current;
        if (w2) w2.busy = false;
      }
    }, 1500);

    watchRef.current = {
      handle,
      timer,
      lastModified: file.lastModified,
      lastSize: file.size,
      busy: false,
    };
    setWatching(handle.name);
    toast(`Watching ${handle.name} — updates live`, 'valid');
  }

  async function handlePaste() {
    const text = await readClipboard();
    if (text === null) {
      toast('Clipboard unavailable — use Upload instead', 'warn');
      return;
    }
    void load(text, 'clipboard');
  }

  async function handleFile(file: File) {
    const r = await readTextFile(file);
    if (!r.ok) {
      toast(r.error ?? 'Could not read file', 'invalid');
      return;
    }
    if (r.warning) toast(r.warning, 'warn');
    void load(r.text ?? '', file.name);
  }

  function handleClear() {
    reqRef.current++;
    stopWatch(false);
    setResult(null);
    setTrace(null);
    setVerdict('idle');
    setSourceName('');
    setSelected(null);
  }

  const meta = trace?.meta;
  const summary =
    verdict === 'valid' && meta
      ? `Session parsed — ${meta.userTurns + meta.assistantTurns} turns, ${meta.toolCalls} tool calls`
      : verdict === 'invalid'
        ? 'Could not parse transcript'
        : verdict === 'working'
          ? 'Parsing…'
          : 'Ready';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton onClick={() => fileInputRef.current?.click()} primary>
          Upload transcript
        </ToolButton>
        {canWatch && (
          <ToolButton
            onClick={() => {
              if (watching) stopWatch();
              else void startWatch();
            }}
            title="Watch a session file and update live as it grows (Chrome/Edge)"
          >
            {watching ? 'Stop watching' : 'Watch live'}
          </ToolButton>
        )}
        <ToolButton onClick={handlePaste}>Paste</ToolButton>
        <ToolButton
          onClick={() => {
            void load(AGENT_TRACE_SAMPLE, 'sample session');
          }}
        >
          Sample
        </ToolButton>
        <ToolButton onClick={handleClear}>Clear</ToolButton>

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

        <label className="flex cursor-pointer items-center gap-1.5 font-mono text-label text-muted">
          <input
            type="checkbox"
            checked={showMeta}
            onChange={(e) => setShowMeta(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Show meta records
        </label>

        {watching && (
          <label className="flex cursor-pointer items-center gap-1.5 font-mono text-label text-muted">
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => setFollow(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Follow tail
          </label>
        )}

        <span className="ml-auto flex items-center gap-2 font-mono text-label text-muted">
          {watching && (
            <span className="flex items-center gap-1.5 text-valid">
              <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-valid" />
              live{lastUpdate ? ` · ${lastUpdate}` : ''}
            </span>
          )}
          {sourceName && <span>{sourceName}</span>}
        </span>
      </div>

      <div className="flex min-h-[440px] items-stretch gap-3">
        <StatusSpine verdict={verdict} summary={summary} />
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {meta && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Turns" value={String(meta.userTurns + meta.assistantTurns)} />
              <Stat label="Tool calls" value={String(meta.toolCalls)} />
              <Stat
                label="Tool errors"
                value={String(meta.toolErrors)}
                tone={meta.toolErrors > 0 ? 'invalid' : undefined}
              />
              <Stat label="Output tokens" value={fmtTokens(meta.usage.outputTokens)} />
              <Stat label="Cache read" value={fmtTokens(meta.usage.cacheReadTokens)} />
              <Stat label="Duration" value={fmtDuration(meta.firstTimestamp, meta.lastTimestamp)} />
            </div>
          )}

          {meta && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
              {meta.models.length > 0 && <span>model: {meta.models.join(', ')}</span>}
              {meta.gitBranch && <span>branch: {meta.gitBranch}</span>}
              {meta.version && <span>claude code v{meta.version}</span>}
              {meta.sidechainTurns > 0 && <span>{meta.sidechainTurns} subagent turns</span>}
              {meta.skippedRecords > 0 && <span>{meta.skippedRecords} non-message records</span>}
            </p>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface">
            <div
              role="tablist"
              aria-label="Trace view"
              className="flex items-center gap-1 border-b border-border px-2 py-1"
            >
              {(['graph', 'timeline'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={
                    'rounded px-2.5 py-1 font-mono text-label capitalize transition-colors duration-fade ' +
                    (view === v ? 'bg-accent/10 text-accent' : 'text-muted hover:text-ink')
                  }
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1">
              {trace ? (
                view === 'graph' ? (
                  <div className="flex h-full min-h-[420px] flex-col gap-2 p-2 md:flex-row">
                    <div className="min-h-0 min-w-0 flex-1">
                      <TraceGraphView
                        session={trace}
                        showMeta={showMeta}
                        selectedId={selected?.id ?? null}
                        onSelect={setSelected}
                        fitKey={fitKey}
                        followTail={watching !== null && follow}
                        exportName={
                          sourceName ? sourceName.replace(/\.(jsonl|ndjson|txt)$/i, '') : 'agent-trace'
                        }
                      />
                    </div>
                    {selected && (
                      <NodeDetail
                        node={selected}
                        session={trace}
                        onClose={() => setSelected(null)}
                      />
                    )}
                  </div>
                ) : (
                  <div className="h-full overflow-auto p-4">
                    <TraceTimeline turns={trace.turns} showMeta={showMeta} />
                  </div>
                )
              ) : (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 p-4 text-center">
                  <p className="font-mono text-label text-muted">
                    Upload a Claude Code session transcript (.jsonl) to see its graph.
                  </p>
                  <p className="max-w-md font-mono text-[11px] leading-relaxed text-muted">
                    Transcripts live in ~/.claude/projects/&lt;project&gt;/&lt;session-id&gt;.jsonl
                    — or press Sample to explore a demo session.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface">
            <ErrorPanel result={result} subject="transcript" okLabel="Transcript parsed" />
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.ndjson,.json,.txt"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
