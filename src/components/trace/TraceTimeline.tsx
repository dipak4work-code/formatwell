'use client';

import { useState } from 'react';
import type { TraceToolCall, TraceTurn } from '@/lib/parsers/agentTrace';

const TEXT_CLAMP = 600;
const RESULT_CLAMP = 900;

function timeOf(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour12: false });
}

/** Long text with a local expand/collapse. */
function ClampedText({ text, clamp }: { text: string; clamp: number }) {
  const [open, setOpen] = useState(false);
  const overflow = text.length > clamp;
  const shown = open || !overflow ? text : `${text.slice(0, clamp)}…`;
  return (
    <div>
      <pre className="whitespace-pre-wrap break-words font-mono text-label leading-6 text-ink">
        {shown}
      </pre>
      {overflow && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 font-mono text-[11px] text-accent hover:underline"
        >
          {open ? 'Show less' : `Show all ${text.length.toLocaleString()} chars`}
        </button>
      )}
    </div>
  );
}

function ToolCallRow({ call }: { call: TraceToolCall }) {
  const [open, setOpen] = useState(false);
  const failed = call.result?.isError === true;
  const pending = call.result === undefined;

  return (
    <div className="rounded-md border border-border bg-bg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left font-mono text-label"
      >
        <span aria-hidden="true" className="text-muted">
          {open ? '▾' : '▸'}
        </span>
        <span className={failed ? 'text-invalid' : 'text-accent'}>{call.name}</span>
        <span className="min-w-0 flex-1 truncate text-muted">{call.inputPreview}</span>
        {failed && <span className="shrink-0 text-invalid">error</span>}
        {pending && <span className="shrink-0 text-muted">no result</span>}
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
          <div>
            <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted">Input</p>
            <ClampedText text={call.input} clamp={TEXT_CLAMP} />
          </div>
          {call.result && (
            <div>
              <p
                className={
                  'mb-1 font-mono text-[11px] uppercase tracking-wide ' +
                  (failed ? 'text-invalid' : 'text-muted')
                }
              >
                Result{failed ? ' (error)' : ''}
              </p>
              <ClampedText text={call.result.content || '(empty)'} clamp={RESULT_CLAMP} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TurnRow({ turn }: { turn: TraceTurn }) {
  const time = timeOf(turn.timestamp);

  const label =
    turn.kind === 'user'
      ? turn.isMeta
        ? 'meta'
        : 'user'
      : turn.kind === 'assistant'
        ? (turn.model ?? 'assistant')
        : (turn.systemLabel ?? 'system');

  const labelColor =
    turn.kind === 'user'
      ? turn.isMeta
        ? 'text-muted'
        : 'text-accent'
      : turn.kind === 'assistant'
        ? 'text-ink'
        : 'text-warn';

  const marker =
    turn.kind === 'user' ? 'bg-accent' : turn.kind === 'assistant' ? 'bg-border' : 'bg-warn';

  return (
    <li className={turn.isSidechain ? 'ml-6 md:ml-10' : ''}>
      <div className="flex gap-3">
        <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-full ${marker}`} />
        <div className="min-w-0 flex-1 pb-4">
          <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-label">
            <span className={`font-500 ${labelColor}`}>{label}</span>
            {turn.isSidechain && (
              <span className="rounded border border-border px-1 text-[10px] uppercase tracking-wide text-muted">
                subagent
              </span>
            )}
            {turn.thinkingChars > 0 && (
              <span className="text-muted">
                thought {turn.thinkingChars.toLocaleString()} chars
              </span>
            )}
            {turn.usage && (
              <span className="text-muted">{turn.usage.outputTokens.toLocaleString()} out tok</span>
            )}
            {turn.hasImages && <span className="text-muted">[image]</span>}
            {time && <span className="ml-auto text-muted">{time}</span>}
          </p>

          {turn.text.trim().length > 0 && (
            <div className={'mt-1 ' + (turn.isMeta ? 'opacity-60' : '')}>
              <ClampedText text={turn.text} clamp={TEXT_CLAMP} />
            </div>
          )}

          {turn.toolCalls.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {turn.toolCalls.map((call) => (
                <ToolCallRow key={call.id} call={call} />
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function TraceTimeline({ turns, showMeta }: { turns: TraceTurn[]; showMeta: boolean }) {
  const visible = showMeta ? turns : turns.filter((t) => !(t.kind === 'user' && t.isMeta));
  return (
    <ol className="relative flex flex-col">
      {visible.map((turn, i) => (
        <TurnRow key={`${turn.line}-${i}`} turn={turn} />
      ))}
    </ol>
  );
}
