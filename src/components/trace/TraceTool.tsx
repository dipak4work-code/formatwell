'use client';

import { useRef, useState } from 'react';
import { StatusSpine } from '@/components/panels/StatusSpine';
import { ErrorPanel } from '@/components/panels/ErrorPanel';
import { ToolButton } from '@/components/ui/ToolButton';
import { useToast } from '@/components/ui/ToastProvider';
import { TraceTimeline } from './TraceTimeline';
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

  async function load(text: string, name: string) {
    const req = ++reqRef.current;
    setSourceName(name);
    setVerdict('working');
    const out = await processorRef.current!.process(text);
    if (req !== reqRef.current) return;
    setResult(out.result);
    setTrace(out.trace);
    setVerdict(verdictFor(out.result));
    if (out.result.ok && out.trace) {
      toast(
        `Parsed ${out.trace.meta.userTurns + out.trace.meta.assistantTurns} turns, ${out.trace.meta.toolCalls} tool calls`,
        'valid',
      );
    } else if (out.result.errors.length > 0) {
      toast(out.result.errors[0]!.message, 'invalid');
    }
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
    setResult(null);
    setTrace(null);
    setVerdict('idle');
    setSourceName('');
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

        {sourceName && (
          <span className="ml-auto font-mono text-label text-muted">{sourceName}</span>
        )}
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

          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface p-4">
            {trace ? (
              <TraceTimeline turns={trace.turns} showMeta={showMeta} />
            ) : (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center">
                <p className="font-mono text-label text-muted">
                  Upload a Claude Code session transcript (.jsonl) to see its timeline.
                </p>
                <p className="max-w-md font-mono text-[11px] leading-relaxed text-muted">
                  Transcripts live in ~/.claude/projects/&lt;project&gt;/&lt;session-id&gt;.jsonl —
                  or press Sample to explore a demo session.
                </p>
              </div>
            )}
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
