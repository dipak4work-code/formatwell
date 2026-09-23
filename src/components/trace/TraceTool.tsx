'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusSpine } from '@/components/panels/StatusSpine';
import { VSplitPane } from '@/components/panels/VSplitPane';
import { ErrorPanel } from '@/components/panels/ErrorPanel';
import { ToolButton } from '@/components/ui/ToolButton';
import { useToast } from '@/components/ui/ToastProvider';
import { TraceTimeline } from './TraceTimeline';
import { TraceGraphView } from './graph/TraceGraph';
import { NodeDetail } from './graph/NodeDetail';
import { layoutTrace, type GraphNode } from './graph/layout';
import { TraceProcessor } from '@/lib/workers/traceClient';
import type { TraceSession } from '@/lib/parsers/agentTrace';
import { verdictFor, type ParseResult, type Verdict } from '@/lib/parsers/types';
import { readClipboard, readTextFile } from '@/lib/utils/io';
import { AGENT_TRACE_SAMPLE } from '@/lib/samples/agentTrace';
import { CODEX_TRACE_SAMPLE } from '@/lib/samples/codexTrace';

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
      <p
        className={`font-600 font-mono text-section ${tone === 'invalid' ? 'text-invalid' : 'text-ink'}`}
      >
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

  // Full screen: pop the graph/timeline panel out to fill the whole display.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === panelRef.current);
      // The panel's available size just changed drastically — re-fit the graph to it.
      setFitKey((k) => k + 1);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      panelRef.current?.requestFullscreen().catch(() => {
        toast('Full screen is not available right now', 'warn');
      });
    }
  }

  // Drag-and-drop onto the main panel. A counter (not a bool) survives dragenter/
  // dragleave firing on nested children as the pointer moves across them.
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);

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

  // Start false so server and first client render agree (avoids hydration mismatch);
  // the real feature check runs client-only, after mount.
  const [canWatch, setCanWatch] = useState(false);
  useEffect(() => {
    setCanWatch('showOpenFilePicker' in window);
  }, []);

  const [canFullscreen, setCanFullscreen] = useState(false);
  useEffect(() => {
    setCanFullscreen(document.fullscreenEnabled ?? false);
  }, []);

  // Step-by-step playback (graph view). playhead = revealed node count; null = full view.
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const graph = useMemo(() => (trace ? layoutTrace(trace, showMeta) : null), [trace, showMeta]);
  const totalSteps = graph?.nodes.length ?? 0;

  // Autoplay ticker.
  useEffect(() => {
    if (!playing || !graph) return;
    const timer = window.setInterval(() => {
      setPlayhead((p) => {
        const next = (p ?? 0) + 1;
        if (next >= graph.nodes.length) {
          setPlaying(false);
          return graph.nodes.length;
        }
        return next;
      });
    }, 700 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, graph]);

  function stepTo(next: number) {
    if (!graph) return;
    const clamped = Math.min(Math.max(next, 0), graph.nodes.length);
    setPlayhead(clamped);
    // Manual stepping narrates: select the newly revealed node so the detail panel follows.
    const node = clamped > 0 ? graph.nodes[clamped - 1] : null;
    setSelected(node ?? null);
  }

  function exitPlayback() {
    setPlaying(false);
    setPlayhead(null);
  }

  async function handlePdf() {
    if (!trace) return;
    toast('Building PDF report…', 'neutral');
    try {
      // Lazy-load the composer/writer so it stays out of the page bundle.
      const { downloadTraceReportPdf } = await import('./report/reportPdf');
      await downloadTraceReportPdf(trace, sourceName || 'agent-trace');
      toast('PDF report downloaded', 'valid');
    } catch {
      toast('PDF export failed', 'invalid');
    }
  }

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
      setPlaying(false);
      setPlayhead(null);
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

  function onDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounter.current++;
    setDragActive(true);
  }

  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault(); // required to allow a drop
  }

  function onDragLeave(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void handleFile(file);
  }

  function handleClear() {
    reqRef.current++;
    stopWatch(false);
    setResult(null);
    setTrace(null);
    setVerdict('idle');
    setSourceName('');
    setSelected(null);
    setPlaying(false);
    setPlayhead(null);
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
            void load(AGENT_TRACE_SAMPLE, 'claude sample');
          }}
        >
          Claude sample
        </ToolButton>
        <ToolButton
          onClick={() => {
            void load(CODEX_TRACE_SAMPLE, 'codex sample');
          }}
        >
          Codex sample
        </ToolButton>
        <ToolButton onClick={handleClear}>Clear</ToolButton>
        <ToolButton
          onClick={handlePdf}
          disabled={!trace}
          title="Download the whole session as a step-by-step PDF report"
        >
          Report PDF
        </ToolButton>

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

      <div className="flex h-[min(85vh,960px)] min-h-[560px] items-stretch gap-3">
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
              <span className="text-accent">
                {meta.format === 'claude-code'
                  ? 'claude code'
                  : meta.format === 'codex'
                    ? 'codex'
                    : 'generic chat'}
              </span>
              {meta.models.length > 0 && <span>model: {meta.models.join(', ')}</span>}
              {meta.gitBranch && <span>branch: {meta.gitBranch}</span>}
              {meta.version && <span>claude code v{meta.version}</span>}
              {meta.sidechainTurns > 0 && <span>{meta.sidechainTurns} subagent turns</span>}
              {meta.skippedRecords > 0 && <span>{meta.skippedRecords} non-message records</span>}
            </p>
          )}

          <VSplitPane
            topLabel="Graph and timeline"
            bottomLabel="Errors"
            top={
              <div
                ref={panelRef}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={
                  'relative flex h-full flex-col overflow-hidden border-border bg-surface ' +
                  (isFullscreen ? 'border-0' : 'rounded-md border')
                }
              >
                {dragActive && (
                  <div
                    aria-hidden="true"
                    className="bg-accent/10 pointer-events-none absolute inset-0 z-10 m-1.5 flex items-center justify-center rounded-md border-2 border-dashed border-accent"
                  >
                    <p className="font-600 font-mono text-body text-accent">
                      Drop transcript file to load
                    </p>
                  </div>
                )}
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
                  {canFullscreen && (
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      title={isFullscreen ? 'Exit full screen' : 'View full screen'}
                      aria-pressed={isFullscreen}
                      className="ml-auto rounded px-2.5 py-1 font-mono text-label text-muted transition-colors duration-fade hover:text-ink"
                    >
                      {isFullscreen ? '⤡ Exit full screen' : '⤢ Full screen'}
                    </button>
                  )}
                </div>

                <div className="min-h-0 flex-1">
                  {trace && graph ? (
                    view === 'graph' ? (
                      <div className="flex h-full min-h-0 flex-col gap-2 p-2">
                        <div
                          aria-label="Playback controls"
                          className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1.5"
                        >
                          <ToolButton
                            onClick={() => {
                              if (playing) {
                                setPlaying(false);
                              } else {
                                if (playhead === null || playhead >= totalSteps) stepTo(0);
                                setSelected(null);
                                setPlaying(true);
                              }
                            }}
                            primary
                            title="Replay the session step by step"
                          >
                            {playing ? '⏸ Pause' : '▶ Play'}
                          </ToolButton>
                          <ToolButton
                            onClick={() => {
                              setPlaying(false);
                              stepTo((playhead ?? 0) - 1);
                            }}
                            disabled={playhead === null || playhead <= 0}
                            title="Step back"
                          >
                            ⏮
                          </ToolButton>
                          <ToolButton
                            onClick={() => {
                              setPlaying(false);
                              stepTo((playhead ?? 0) + 1);
                            }}
                            disabled={playhead !== null && playhead >= totalSteps}
                            title="Step forward"
                          >
                            ⏭
                          </ToolButton>

                          <input
                            type="range"
                            min={0}
                            max={totalSteps}
                            value={playhead ?? totalSteps}
                            onChange={(e) => {
                              setPlaying(false);
                              stepTo(Number(e.target.value));
                            }}
                            aria-label="Playback position"
                            className="min-w-24 flex-1 accent-[var(--accent)]"
                          />
                          <span className="font-mono text-label tabular-nums text-muted">
                            {playhead ?? totalSteps}/{totalSteps}
                          </span>

                          <select
                            value={String(speed)}
                            onChange={(e) => setSpeed(Number(e.target.value))}
                            aria-label="Playback speed"
                            className="rounded border border-border bg-surface px-1.5 py-1 font-mono text-label text-ink"
                          >
                            <option value="0.5">0.5×</option>
                            <option value="1">1×</option>
                            <option value="2">2×</option>
                            <option value="4">4×</option>
                          </select>

                          {playhead !== null && (
                            <ToolButton onClick={exitPlayback} title="Show the full graph">
                              Exit
                            </ToolButton>
                          )}
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
                          <div className="min-h-0 min-w-0 flex-1">
                            <TraceGraphView
                              graph={graph}
                              selectedId={selected?.id ?? null}
                              onSelect={setSelected}
                              fitKey={fitKey}
                              followTail={watching !== null && follow}
                              exportName={
                                sourceName
                                  ? sourceName.replace(/\.(jsonl|ndjson|txt)$/i, '')
                                  : 'agent-trace'
                              }
                              revealCount={playhead ?? undefined}
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
                      </div>
                    ) : (
                      <div className="h-full overflow-auto p-4">
                        <TraceTimeline turns={trace.turns} showMeta={showMeta} />
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="hover:bg-accent/5 flex h-full min-h-[280px] w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors duration-fade"
                    >
                      <p className="font-mono text-label text-muted">
                        Click, drag and drop, or paste an agent session transcript (.jsonl) to see
                        its graph.
                      </p>
                      <p className="max-w-md font-mono text-[11px] leading-relaxed text-muted">
                        Claude Code: ~/.claude/projects/&lt;project&gt;/&lt;session-id&gt;.jsonl ·
                        Codex: ~/.codex/sessions/&lt;date&gt;/rollout-*.jsonl · other agents&apos;
                        role/content chat JSONL also works — or try a sample.
                      </p>
                    </button>
                  )}
                </div>
              </div>
            }
            bottom={
              <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-surface">
                <ErrorPanel result={result} subject="transcript" okLabel="Transcript parsed" />
              </div>
            }
          />
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
