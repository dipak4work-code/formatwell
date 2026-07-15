import type { ParseIssue, ParseResult } from './types';
import { byteLength } from '@/lib/utils/bytes';

/**
 * Parser for Claude Code session transcripts (the .jsonl files under
 * ~/.claude/projects/<project>/<session-id>.jsonl). Each line is one JSON record.
 * The renderable records are:
 *   - type "user":      a human prompt (content string or text/image blocks) OR a
 *                        tool_result carrier ({type:"tool_result", tool_use_id, ...})
 *   - type "assistant": message with content blocks: thinking | text | tool_use,
 *                        plus model / usage / stop_reason metadata
 *   - type "system":    subtype/level events (e.g. api_error)
 * Other record types (queue-operation, attachment, file-history-snapshot, ai-title,
 * last-prompt, mode, …) are counted but not rendered. Unknown types must never fail
 * the parse — transcripts evolve between Claude Code versions.
 */

export interface TraceToolCall {
  id: string;
  name: string;
  /** Compact one-line JSON of the input (already truncated for display). */
  inputPreview: string;
  /** Full pretty JSON of the input for the expanded view. */
  input: string;
  result?: {
    /** Possibly long; UI truncates. */
    content: string;
    isError: boolean;
  };
}

export interface TraceUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface TraceTurn {
  kind: 'user' | 'assistant' | 'system';
  /** 1-based line number of the first record in this turn (for error jumps). */
  line: number;
  timestamp?: string;
  /** Joined text blocks (user prompt or assistant prose). */
  text: string;
  /** Total characters of thinking blocks (content itself is not surfaced). */
  thinkingChars: number;
  toolCalls: TraceToolCall[];
  model?: string;
  usage?: TraceUsage;
  isSidechain: boolean;
  /** Synthetic/meta user records (command output, reminders) — rendered dimmed. */
  isMeta: boolean;
  /** For system records: "subtype (level)". */
  systemLabel?: string;
  hasImages: boolean;
}

export interface TraceSession {
  turns: TraceTurn[];
  meta: {
    sessionId?: string;
    version?: string;
    gitBranch?: string;
    cwd?: string;
    models: string[];
    firstTimestamp?: string;
    lastTimestamp?: string;
    userTurns: number;
    assistantTurns: number;
    toolCalls: number;
    toolErrors: number;
    sidechainTurns: number;
    skippedRecords: number;
    usage: TraceUsage;
  };
}

export interface TraceParseOutput {
  result: ParseResult;
  trace: TraceSession | null;
}

const INPUT_PREVIEW_MAX = 120;

function emptyUsage(): TraceUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
}

function addUsage(total: TraceUsage, u: Record<string, unknown> | undefined): TraceUsage | undefined {
  if (!u || typeof u !== 'object') return undefined;
  const n = (k: string) => (typeof u[k] === 'number' ? (u[k] as number) : 0);
  const turn: TraceUsage = {
    inputTokens: n('input_tokens'),
    outputTokens: n('output_tokens'),
    cacheReadTokens: n('cache_read_input_tokens'),
    cacheCreationTokens: n('cache_creation_input_tokens'),
  };
  total.inputTokens += turn.inputTokens;
  total.outputTokens += turn.outputTokens;
  total.cacheReadTokens += turn.cacheReadTokens;
  total.cacheCreationTokens += turn.cacheCreationTokens;
  return turn;
}

function mergeUsage(a: TraceUsage | undefined, b: TraceUsage | undefined): TraceUsage | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
  };
}

function previewJson(value: unknown): string {
  let s: string;
  try {
    s = JSON.stringify(value) ?? 'null';
  } catch {
    s = '[unserializable]';
  }
  return s.length > INPUT_PREVIEW_MAX ? `${s.slice(0, INPUT_PREVIEW_MAX)}…` : s;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return '[unserializable]';
  }
}

/** tool_result content can be a string or an array of blocks; flatten to text. */
function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === 'string') return b;
        if (b && typeof b === 'object' && 'text' in b) return String((b as { text: unknown }).text);
        if (b && typeof b === 'object' && (b as { type?: string }).type === 'image')
          return '[image]';
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (content == null) return '';
  return String(content);
}

type Rec = Record<string, unknown>;

function asRec(v: unknown): Rec | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null;
}

export function parseAgentTrace(input: string): TraceParseOutput {
  const start = performance.now();
  const stats = () => ({
    bytes: byteLength(input),
    lines: input.length === 0 ? 0 : input.split('\n').length,
    parseMs: performance.now() - start,
  });

  if (input.trim().length === 0) {
    return { result: { ok: false, errors: [], stats: stats() }, trace: null };
  }

  const errors: ParseIssue[] = [];
  const turns: TraceTurn[] = [];
  const meta: TraceSession['meta'] = {
    models: [],
    userTurns: 0,
    assistantTurns: 0,
    toolCalls: 0,
    toolErrors: 0,
    sidechainTurns: 0,
    skippedRecords: 0,
    usage: emptyUsage(),
  };

  /** Open tool calls by tool_use id, so results can attach across lines. */
  const openCalls = new Map<string, TraceToolCall>();
  let current: TraceTurn | null = null;

  const lines = input.split('\n');
  let renderableSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.replace(/\r$/, '');
    if (raw.trim().length === 0) continue;
    const lineNo = i + 1;

    let rec: Rec | null;
    try {
      rec = asRec(JSON.parse(raw));
    } catch {
      errors.push({
        line: lineNo,
        column: 1,
        message: 'Line is not valid JSON.',
        severity: 'error',
      });
      continue;
    }
    if (!rec) {
      errors.push({
        line: lineNo,
        column: 1,
        message: 'Line is valid JSON but not a record object.',
        severity: 'warning',
      });
      continue;
    }

    const type = typeof rec.type === 'string' ? rec.type : '';
    if (typeof rec.sessionId === 'string' && !meta.sessionId) meta.sessionId = rec.sessionId;
    if (typeof rec.version === 'string' && !meta.version) meta.version = rec.version;
    if (typeof rec.gitBranch === 'string' && !meta.gitBranch) meta.gitBranch = rec.gitBranch;
    if (typeof rec.cwd === 'string' && !meta.cwd) meta.cwd = rec.cwd;

    if (type !== 'user' && type !== 'assistant' && type !== 'system') {
      meta.skippedRecords++;
      continue;
    }

    renderableSeen = true;
    const ts = typeof rec.timestamp === 'string' ? rec.timestamp : undefined;
    if (ts) {
      if (!meta.firstTimestamp) meta.firstTimestamp = ts;
      meta.lastTimestamp = ts;
    }
    const isSidechain = rec.isSidechain === true;
    const isMeta = rec.isMeta === true;

    if (type === 'system') {
      const subtype = typeof rec.subtype === 'string' ? rec.subtype : 'event';
      const level = typeof rec.level === 'string' ? rec.level : '';
      turns.push({
        kind: 'system',
        line: lineNo,
        timestamp: ts,
        text: typeof rec.content === 'string' ? rec.content : '',
        thinkingChars: 0,
        toolCalls: [],
        isSidechain,
        isMeta: false,
        systemLabel: level ? `${subtype} (${level})` : subtype,
        hasImages: false,
      });
      current = null;
      continue;
    }

    const message = asRec(rec.message);
    const content = message?.content;

    if (type === 'user') {
      // Tool-result carrier lines attach to open calls instead of becoming turns.
      if (Array.isArray(content) && content.some((b) => asRec(b)?.type === 'tool_result')) {
        for (const b of content) {
          const block = asRec(b);
          if (!block || block.type !== 'tool_result') continue;
          const id = typeof block.tool_use_id === 'string' ? block.tool_use_id : '';
          const call = openCalls.get(id);
          const isError = block.is_error === true;
          if (isError) meta.toolErrors++;
          if (call) {
            call.result = { content: resultText(block.content), isError };
            openCalls.delete(id);
          }
        }
        continue;
      }

      const parts: string[] = [];
      let hasImages = false;
      if (typeof content === 'string') parts.push(content);
      else if (Array.isArray(content)) {
        for (const b of content) {
          const block = asRec(b);
          if (!block) continue;
          if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
          if (block.type === 'image') hasImages = true;
        }
      }

      const turn: TraceTurn = {
        kind: 'user',
        line: lineNo,
        timestamp: ts,
        text: parts.join('\n\n'),
        thinkingChars: 0,
        toolCalls: [],
        isSidechain,
        isMeta,
        hasImages,
      };
      turns.push(turn);
      if (!isMeta) meta.userTurns++;
      if (isSidechain) meta.sidechainTurns++;
      current = null;
      continue;
    }

    // assistant — merge consecutive assistant records into one turn.
    if (
      !current ||
      current.kind !== 'assistant' ||
      current.isSidechain !== isSidechain
    ) {
      current = {
        kind: 'assistant',
        line: lineNo,
        timestamp: ts,
        text: '',
        thinkingChars: 0,
        toolCalls: [],
        isSidechain,
        isMeta: false,
        hasImages: false,
      };
      turns.push(current);
      meta.assistantTurns++;
      if (isSidechain) meta.sidechainTurns++;
    }

    const model = typeof message?.model === 'string' ? message.model : undefined;
    // "<synthetic>" appears on injected/meta assistant records — not a real model.
    if (model && model !== '<synthetic>') {
      current.model = model;
      if (!meta.models.includes(model)) meta.models.push(model);
    }
    current.usage = mergeUsage(current.usage, addUsage(meta.usage, asRec(message?.usage) ?? undefined));

    if (Array.isArray(content)) {
      for (const b of content) {
        const block = asRec(b);
        if (!block) continue;
        if (block.type === 'text' && typeof block.text === 'string') {
          current.text += (current.text ? '\n\n' : '') + block.text;
        } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
          current.thinkingChars += block.thinking.length;
        } else if (block.type === 'tool_use') {
          const call: TraceToolCall = {
            id: typeof block.id === 'string' ? block.id : `call-${lineNo}`,
            name: typeof block.name === 'string' ? block.name : 'unknown',
            inputPreview: previewJson(block.input),
            input: prettyJson(block.input),
          };
          current.toolCalls.push(call);
          openCalls.set(call.id, call);
          meta.toolCalls++;
        }
      }
    }
  }

  if (!renderableSeen) {
    errors.push({
      line: 1,
      column: 1,
      message:
        'No user/assistant/system records found — is this a Claude Code session transcript?',
      severity: 'error',
    });
  }

  const ok = errors.filter((e) => e.severity === 'error').length === 0;
  return {
    result: { ok, errors, stats: stats() },
    trace: ok ? { turns, meta } : null,
  };
}
