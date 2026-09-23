'use client';

import type { ParseIssue, ParseResult } from '@/lib/parsers/types';

interface ErrorPanelProps {
  result: ParseResult | null;
  /** Called when an error row is clicked — used to jump the editor cursor. */
  onSelect?: (issue: ParseIssue) => void;
  /** Noun for the empty/valid state, e.g. "JSON". */
  subject?: string;
  /** Overrides the default "Valid {subject}" confirmation text. */
  okLabel?: string;
}

function formatStats(result: ParseResult): string {
  const { stats } = result;
  if (!stats) return '';
  const parts = [`${stats.lines} lines`, `${stats.bytes.toLocaleString()} bytes`];
  if (stats.parseMs >= 0) parts.push(`${stats.parseMs.toFixed(1)} ms`);
  return parts.join(' · ');
}

export function ErrorPanel({ result, onSelect, subject = 'input', okLabel }: ErrorPanelProps) {
  if (!result) {
    return <p className="px-3 py-2 font-mono text-label text-muted">Nothing validated yet.</p>;
  }

  const errors = result.errors ?? [];

  if (errors.length === 0) {
    // Quiet confirmation — never a celebration graphic (spec §6.5).
    return (
      <p className="flex items-center gap-2 px-3 py-2 font-mono text-label text-valid">
        <span aria-hidden="true">✓</span>
        <span>
          {okLabel ?? `Valid ${subject}`}
          {result.stats ? <span className="text-muted"> — {formatStats(result)}</span> : null}
        </span>
      </p>
    );
  }

  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warnCount = errors.filter((e) => e.severity === 'warning').length;

  return (
    <div className="flex h-full flex-col">
      <p className="border-b border-border px-3 py-2 font-mono text-label text-muted">
        {errorCount > 0 && (
          <span className="text-invalid">
            {errorCount} error{errorCount === 1 ? '' : 's'}
          </span>
        )}
        {errorCount > 0 && warnCount > 0 && <span> · </span>}
        {warnCount > 0 && (
          <span className="text-warn">
            {warnCount} warning{warnCount === 1 ? '' : 's'}
          </span>
        )}
      </p>
      <ul className="min-h-0 flex-1 overflow-auto">
        {errors.map((issue, i) => (
          <li key={`${issue.line}:${issue.column}:${i}`}>
            <button
              type="button"
              onClick={() => onSelect?.(issue)}
              className="hover:bg-accent/10 flex w-full items-baseline gap-2 px-3 py-1.5 text-left font-mono text-label transition-colors duration-fade"
            >
              <span
                className={
                  'shrink-0 tabular-nums ' +
                  (issue.severity === 'error' ? 'text-invalid' : 'text-warn')
                }
              >
                Line {issue.line}, Col {issue.column}
              </span>
              <span className="text-muted">—</span>
              <span className="text-ink">{issue.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
