import { parseAgentTrace, type TraceFormat, type TraceParseOutput } from './agentTrace';
import { parseCodexTrace } from './codexTrace';
import { parseGenericTrace } from './genericTrace';
import { byteLength } from '@/lib/utils/bytes';

/**
 * Format auto-detection + routing for agent transcripts. Scans up to the first 500
 * parseable lines for decisive markers:
 *   - Claude Code: type user/assistant records carrying uuid/parentUuid/isSidechain,
 *     or Claude-only record types (ai-title, queue-operation, file-history-snapshot…)
 *   - Codex CLI:   wrapper types session_meta / response_item / turn_context /
 *     event_msg / compacted, or legacy record_type field
 *   - generic:     anything with role/content chat records (other LLM agents)
 */

const CLAUDE_ONLY_TYPES = new Set([
  'ai-title',
  'queue-operation',
  'file-history-snapshot',
  'last-prompt',
  'attachment',
]);

const CODEX_WRAPPER_TYPES = new Set([
  'session_meta',
  'response_item',
  'turn_context',
  'event_msg',
  'compacted',
]);

const SCAN_LIMIT = 500;

export function detectTraceFormat(input: string): TraceFormat | null {
  let generic = false;
  let scanned = 0;

  for (const rawLine of input.split('\n')) {
    if (scanned >= SCAN_LIMIT) break;
    const raw = rawLine.trim();
    if (!raw) continue;
    scanned++;

    let rec: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      rec = parsed as Record<string, unknown>;
    } catch {
      continue;
    }

    const type = typeof rec.type === 'string' ? rec.type : '';

    // Decisive Claude Code markers.
    if (CLAUDE_ONLY_TYPES.has(type)) return 'claude-code';
    if (
      (type === 'user' || type === 'assistant' || type === 'system') &&
      ('uuid' in rec || 'parentUuid' in rec || 'isSidechain' in rec)
    ) {
      return 'claude-code';
    }

    // Decisive Codex markers.
    if (CODEX_WRAPPER_TYPES.has(type)) return 'codex';
    if ('record_type' in rec) return 'codex';
    // Legacy top-level response items: function_call etc. are Codex-shaped.
    if (type === 'function_call' || type === 'function_call_output' || type === 'reasoning') {
      return 'codex';
    }

    // Chat-style shapes qualify for the generic adapter (keep scanning for a
    // decisive marker; fall back to generic only if none appears).
    const msg =
      rec.message && typeof rec.message === 'object' && !Array.isArray(rec.message)
        ? (rec.message as Record<string, unknown>)
        : rec;
    if (typeof msg.role === 'string') generic = true;
  }

  return generic ? 'generic' : null;
}

/** Parse any supported agent transcript, auto-detecting its format. */
export function parseTrace(input: string): TraceParseOutput {
  if (input.trim().length === 0) {
    return {
      result: {
        ok: false,
        errors: [],
        stats: { bytes: byteLength(input), lines: 0, parseMs: 0 },
      },
      trace: null,
    };
  }

  const format = detectTraceFormat(input);
  switch (format) {
    case 'claude-code':
      return parseAgentTrace(input);
    case 'codex':
      return parseCodexTrace(input);
    case 'generic':
      return parseGenericTrace(input);
    default:
      return {
        result: {
          ok: false,
          errors: [
            {
              line: 1,
              column: 1,
              message:
                'Unrecognized transcript format — expected a Claude Code session, a Codex rollout, or chat-style JSONL with role/content records.',
              severity: 'error',
            },
          ],
          stats: {
            bytes: byteLength(input),
            lines: input.split('\n').length,
            parseMs: 0,
          },
        },
        trace: null,
      };
  }
}
