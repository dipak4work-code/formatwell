/**
 * Shared result contract (spec §5). Every parser (JSON, XML, Markdown) returns this
 * shape so the UI — editor diagnostics, ErrorPanel, StatusSpine — is built once.
 */

export type Severity = 'error' | 'warning';

export interface ParseIssue {
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  /** Human-readable, plain-language message. */
  message: string;
  severity: Severity;
}

export interface ParseStats {
  bytes: number;
  lines: number;
  parseMs: number;
  /** Number of records — used by JSONL. */
  records?: number;
}

export interface ParseResult {
  ok: boolean;
  /** Pretty-printed output when ok. */
  formatted?: string;
  errors: ParseIssue[];
  stats?: ParseStats;
}

/** Overall verdict derived from a ParseResult — drives StatusSpine + summaries. */
export type Verdict = 'idle' | 'valid' | 'invalid' | 'warnings' | 'working';

export function verdictFor(result: ParseResult | null, working = false): Verdict {
  if (working) return 'working';
  if (!result) return 'idle';
  if (!result.ok || result.errors.some((e) => e.severity === 'error')) return 'invalid';
  if (result.errors.some((e) => e.severity === 'warning')) return 'warnings';
  return 'valid';
}
