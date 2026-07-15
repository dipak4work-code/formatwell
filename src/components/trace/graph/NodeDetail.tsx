'use client';

import type { TraceSession } from '@/lib/parsers/agentTrace';
import type { GraphNode } from './layout';

function Section({ title, text, tone }: { title: string; text: string; tone?: 'invalid' }) {
  return (
    <div>
      <p
        className={
          'mb-1 font-mono text-[11px] uppercase tracking-wide ' +
          (tone === 'invalid' ? 'text-invalid' : 'text-muted')
        }
      >
        {title}
      </p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-bg p-2 font-mono text-label leading-6 text-ink">
        {text || '(empty)'}
      </pre>
    </div>
  );
}

export function NodeDetail({
  node,
  session,
  onClose,
}: {
  node: GraphNode;
  session: TraceSession;
  onClose: () => void;
}) {
  const turn = node.turnIndex !== undefined ? session.turns[node.turnIndex] : undefined;

  return (
    <aside
      aria-label="Node details"
      className="flex w-full flex-col gap-3 overflow-auto rounded-md border border-border bg-surface p-3 md:w-96"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 font-mono text-label font-600 text-ink">
          <span className={node.isError ? 'text-invalid' : 'text-accent'}>{node.label}</span>
          {node.isSidechain && <span className="ml-2 text-muted">· subagent</span>}
          {turn?.timestamp && (
            <span className="ml-2 text-muted">
              {new Date(turn.timestamp).toLocaleTimeString([], { hour12: false })}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded border border-border px-2 py-0.5 font-mono text-label text-muted hover:text-ink"
        >
          ✕
        </button>
      </div>

      {node.kind === 'tool' && node.toolCall ? (
        <>
          <Section title="Input" text={node.toolCall.input} />
          {node.toolCall.result ? (
            <Section
              title={node.toolCall.result.isError ? 'Result (error)' : 'Result'}
              text={node.toolCall.result.content}
              tone={node.toolCall.result.isError ? 'invalid' : undefined}
            />
          ) : (
            <p className="font-mono text-label text-muted">No result recorded.</p>
          )}
        </>
      ) : turn ? (
        <>
          {turn.text.trim() && <Section title="Message" text={turn.text} />}
          {turn.thinkingChars > 0 && (
            <p className="font-mono text-label text-muted">
              Thought for {turn.thinkingChars.toLocaleString()} characters (thinking content not
              shown).
            </p>
          )}
          {turn.usage && (
            <p className="font-mono text-label text-muted">
              tokens: {turn.usage.inputTokens} in · {turn.usage.outputTokens} out ·{' '}
              {turn.usage.cacheReadTokens.toLocaleString()} cache read
            </p>
          )}
          {turn.toolCalls.length > 0 && (
            <p className="font-mono text-label text-muted">
              {turn.toolCalls.length} tool call{turn.toolCalls.length === 1 ? '' : 's'} — click the
              tool nodes to inspect each.
            </p>
          )}
        </>
      ) : null}
    </aside>
  );
}
