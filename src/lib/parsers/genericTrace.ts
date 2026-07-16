import type { ParseIssue, ParseResult } from './types';
import type { TraceParseOutput, TraceSession, TraceToolCall, TraceTurn } from './agentTrace';
import { byteLength } from '@/lib/utils/bytes';

/**
 * Best-effort adapter for other agents' chat-style JSONL: each line is (or contains
 * under `message`) an object with `role` and `content`, optionally with OpenAI-style
 * `tool_calls` on assistant messages and role:"tool" result lines linked by
 * `tool_call_id`. Anything unrecognized is skipped, never fatal.
 */

type Rec = Record<string, unknown>;

function asRec(v: unknown): Rec | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((b) => {
      if (typeof b === 'string') return b;
      const block = asRec(b);
      return block ? (str(block.text) ?? '') : '';
    })
    .filter(Boolean)
    .join('\n');
}

function timestampOf(rec: Rec): string | undefined {
  const raw = rec.timestamp ?? rec.ts ?? rec.time ?? rec.created_at ?? rec.createdAt;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') {
    // Seconds vs milliseconds epoch.
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

function prettyArgs(v: unknown): string {
  if (typeof v === 'string') {
    try {
      return JSON.stringify(JSON.parse(v), null, 2);
    } catch {
      return v;
    }
  }
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}

const PREVIEW_MAX = 120;
function previewOf(s: string): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_MAX ? `${flat.slice(0, PREVIEW_MAX)}…` : flat;
}

export function parseGenericTrace(input: string): TraceParseOutput {
  const start = performance.now();
  const stats = () => ({
    bytes: byteLength(input),
    lines: input.length === 0 ? 0 : input.split('\n').length,
    parseMs: performance.now() - start,
  });

  const errors: ParseIssue[] = [];
  const turns: TraceTurn[] = [];
  const meta: TraceSession['meta'] = {
    format: 'generic',
    models: [],
    userTurns: 0,
    assistantTurns: 0,
    toolCalls: 0,
    toolErrors: 0,
    sidechainTurns: 0,
    skippedRecords: 0,
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  };

  const openCalls = new Map<string, TraceToolCall>();
  let current: TraceTurn | null = null;

  const lines = input.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.replace(/\r$/, '');
    if (raw.trim().length === 0) continue;
    const lineNo = i + 1;

    let rec: Rec | null;
    try {
      rec = asRec(JSON.parse(raw));
    } catch {
      errors.push({ line: lineNo, column: 1, message: 'Line is not valid JSON.', severity: 'error' });
      continue;
    }
    if (!rec) {
      meta.skippedRecords++;
      continue;
    }

    const msg = asRec(rec.message) ?? rec;
    const role = str(msg.role);
    const ts = timestampOf(rec) ?? timestampOf(msg);
    if (ts) {
      if (!meta.firstTimestamp) meta.firstTimestamp = ts;
      meta.lastTimestamp = ts;
    }
    const model = str(msg.model) ?? str(rec.model);
    if (model && !meta.models.includes(model)) meta.models.push(model);

    if (!role) {
      meta.skippedRecords++;
      continue;
    }

    if (role === 'tool' || role === 'function') {
      const id = str(msg.tool_call_id) ?? str(msg.id) ?? '';
      const call = openCalls.get(id);
      const isError = msg.is_error === true || msg.isError === true;
      if (isError) meta.toolErrors++;
      if (call) {
        call.result = { content: contentText(msg.content), isError };
        openCalls.delete(id);
      }
      continue;
    }

    if (role === 'assistant') {
      if (!current || current.kind !== 'assistant') {
        current = {
          kind: 'assistant',
          line: lineNo,
          timestamp: ts,
          text: '',
          thinkingChars: 0,
          toolCalls: [],
          isSidechain: false,
          isMeta: false,
          hasImages: false,
          model,
        };
        turns.push(current);
        meta.assistantTurns++;
      }
      const text = contentText(msg.content);
      if (text) current.text += (current.text ? '\n\n' : '') + text;

      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const callRec = asRec(tc);
          if (!callRec) continue;
          const fn = asRec(callRec.function);
          const pretty = prettyArgs(fn?.arguments ?? callRec.arguments ?? callRec.input);
          const call: TraceToolCall = {
            id: str(callRec.id) ?? `call-${lineNo}-${current.toolCalls.length}`,
            name: (fn && str(fn.name)) ?? str(callRec.name) ?? 'tool',
            inputPreview: previewOf(pretty),
            input: pretty,
          };
          current.toolCalls.push(call);
          openCalls.set(call.id, call);
          meta.toolCalls++;
        }
      }
      continue;
    }

    if (role === 'user' || role === 'system' || role === 'developer') {
      turns.push({
        kind: 'user',
        line: lineNo,
        timestamp: ts,
        text: contentText(msg.content),
        thinkingChars: 0,
        toolCalls: [],
        isSidechain: false,
        isMeta: role !== 'user',
        hasImages: false,
      });
      if (role === 'user') meta.userTurns++;
      current = null;
      continue;
    }

    meta.skippedRecords++;
  }

  if (turns.length === 0) {
    errors.push({
      line: 1,
      column: 1,
      message:
        'No chat records found — expected JSONL lines with role/content (optionally under "message").',
      severity: 'error',
    });
  }

  const ok = errors.filter((e) => e.severity === 'error').length === 0;
  const result: ParseResult = { ok, errors, stats: stats() };
  return { result, trace: ok ? { turns, meta } : null };
}
