import type { ParseIssue, ParseResult } from './types';
import type {
  TraceParseOutput,
  TraceSession,
  TraceToolCall,
  TraceTurn,
  TraceUsage,
} from './agentTrace';
import { byteLength } from '@/lib/utils/bytes';

/**
 * Adapter for OpenAI Codex CLI rollout transcripts
 * (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl). Each line wraps a payload:
 *   - session_meta:  session id, cli_version, cwd, git info
 *   - turn_context:  model + policies for the following turn
 *   - response_item: a Responses-API item — message (user/assistant), reasoning,
 *                    function_call / function_call_output (linked by call_id),
 *                    local_shell_call, web_search_call, custom_tool_call…
 *   - event_msg:     UI events; token_count carries cumulative usage
 *   - compacted:     history compaction marker
 * Older rollouts put response items at the top level (no wrapper) — handled too.
 * Unknown types are counted, never fatal.
 */

type Rec = Record<string, unknown>;

function asRec(v: unknown): Rec | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

const INPUT_PREVIEW_MAX = 120;

function previewOf(s: string): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > INPUT_PREVIEW_MAX ? `${flat.slice(0, INPUT_PREVIEW_MAX)}…` : flat;
}

/** Pretty-print a JSON-string argument blob; fall back to the raw string. */
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

/** Codex message content: array of {type:'input_text'|'output_text'|…, text}. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((b) => {
      const block = asRec(b);
      if (!block) return typeof b === 'string' ? b : '';
      return str(block.text) ?? '';
    })
    .filter(Boolean)
    .join('\n');
}

/** Synthetic wrapper prompts Codex injects around real user input. */
function isSyntheticUserText(text: string): boolean {
  const head = text.trimStart().slice(0, 40);
  return (
    head.startsWith('<user_instructions>') ||
    head.startsWith('<environment_context>') ||
    head.startsWith('<ide_context>') ||
    head.startsWith('<turn_context>')
  );
}

/** function_call_output payloads are often JSON strings {output, metadata:{exit_code}}. */
function parseToolOutput(output: unknown): { content: string; isError: boolean } {
  if (typeof output === 'string') {
    try {
      const parsed = asRec(JSON.parse(output));
      if (parsed && typeof parsed.output === 'string') {
        const metadata = asRec(parsed.metadata);
        const exit = metadata && typeof metadata.exit_code === 'number' ? metadata.exit_code : 0;
        return { content: parsed.output, isError: exit !== 0 };
      }
    } catch {
      /* raw string */
    }
    return { content: output, isError: false };
  }
  const rec = asRec(output);
  if (rec && typeof rec.output === 'string') {
    const metadata = asRec(rec.metadata);
    const exit = metadata && typeof metadata.exit_code === 'number' ? metadata.exit_code : 0;
    return { content: rec.output, isError: exit !== 0 };
  }
  return { content: output == null ? '' : String(output), isError: false };
}

export function parseCodexTrace(input: string): TraceParseOutput {
  const start = performance.now();
  const stats = () => ({
    bytes: byteLength(input),
    lines: input.length === 0 ? 0 : input.split('\n').length,
    parseMs: performance.now() - start,
  });

  const errors: ParseIssue[] = [];
  const turns: TraceTurn[] = [];
  const meta: TraceSession['meta'] = {
    format: 'codex',
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
  let currentModel: string | undefined;

  const ensureAssistant = (lineNo: number, ts?: string): TraceTurn => {
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
        model: currentModel,
      };
      turns.push(current);
      meta.assistantTurns++;
    }
    return current;
  };

  const addToolCall = (lineNo: number, ts: string | undefined, call: TraceToolCall) => {
    const turn = ensureAssistant(lineNo, ts);
    turn.toolCalls.push(call);
    openCalls.set(call.id, call);
    meta.toolCalls++;
  };

  const handleItem = (item: Rec, lineNo: number, ts?: string): boolean => {
    const type = str(item.type) ?? '';

    if (type === 'message') {
      const role = str(item.role);
      const text = contentText(item.content);
      if (role === 'user') {
        const synthetic = isSyntheticUserText(text);
        turns.push({
          kind: 'user',
          line: lineNo,
          timestamp: ts,
          text,
          thinkingChars: 0,
          toolCalls: [],
          isSidechain: false,
          isMeta: synthetic,
          hasImages: Array.isArray(item.content)
            ? item.content.some((b) => asRec(b)?.type === 'input_image')
            : false,
        });
        if (!synthetic) meta.userTurns++;
        current = null;
        return true;
      }
      if (role === 'assistant') {
        const turn = ensureAssistant(lineNo, ts);
        turn.text += (turn.text ? '\n\n' : '') + text;
        return true;
      }
      // system/developer messages → meta user input
      turns.push({
        kind: 'user',
        line: lineNo,
        timestamp: ts,
        text,
        thinkingChars: 0,
        toolCalls: [],
        isSidechain: false,
        isMeta: true,
        hasImages: false,
      });
      current = null;
      return true;
    }

    if (type === 'reasoning') {
      const turn = ensureAssistant(lineNo, ts);
      const summary = Array.isArray(item.summary) ? contentText(item.summary) : '';
      const body = Array.isArray(item.content) ? contentText(item.content) : '';
      turn.thinkingChars += summary.length + body.length;
      return true;
    }

    if (type === 'function_call' || type === 'custom_tool_call') {
      const args = type === 'custom_tool_call' ? (item.input ?? item.arguments) : item.arguments;
      const pretty = prettyArgs(args);
      addToolCall(lineNo, ts, {
        id: str(item.call_id) ?? str(item.id) ?? `call-${lineNo}`,
        name: str(item.name) ?? 'tool',
        inputPreview: previewOf(pretty),
        input: pretty,
      });
      return true;
    }

    if (type === 'local_shell_call') {
      const action = asRec(item.action);
      const command = action && Array.isArray(action.command) ? action.command.join(' ') : '';
      addToolCall(lineNo, ts, {
        id: str(item.call_id) ?? str(item.id) ?? `call-${lineNo}`,
        name: 'shell',
        inputPreview: previewOf(command),
        input: command,
      });
      return true;
    }

    if (type === 'web_search_call') {
      const action = asRec(item.action);
      const query = (action && str(action.query)) ?? '';
      addToolCall(lineNo, ts, {
        id: str(item.id) ?? `call-${lineNo}`,
        name: 'web_search',
        inputPreview: previewOf(query),
        input: query,
      });
      // Search calls carry status but no separate output record we can rely on.
      return true;
    }

    if (type === 'function_call_output' || type === 'custom_tool_call_output') {
      const id = str(item.call_id) ?? '';
      const call = openCalls.get(id);
      const parsed = parseToolOutput(item.output);
      if (parsed.isError) meta.toolErrors++;
      if (call) {
        call.result = parsed;
        openCalls.delete(id);
      }
      return true;
    }

    return false;
  };

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

    const wrapperType = str(rec.type) ?? '';
    const ts = str(rec.timestamp);
    if (ts) {
      if (!meta.firstTimestamp) meta.firstTimestamp = ts;
      meta.lastTimestamp = ts;
    }

    if (wrapperType === 'session_meta') {
      const payload = asRec(rec.payload);
      if (payload) {
        meta.sessionId = str(payload.id) ?? meta.sessionId;
        meta.version = str(payload.cli_version) ?? meta.version;
        meta.cwd = str(payload.cwd) ?? meta.cwd;
        const git = asRec(payload.git);
        if (git) meta.gitBranch = str(git.branch) ?? meta.gitBranch;
      }
      continue;
    }

    if (wrapperType === 'turn_context') {
      const payload = asRec(rec.payload);
      const model = payload && str(payload.model);
      if (model) {
        currentModel = model;
        if (!meta.models.includes(model)) meta.models.push(model);
      }
      continue;
    }

    if (wrapperType === 'response_item') {
      const payload = asRec(rec.payload);
      if (!payload || !handleItem(payload, lineNo, ts)) meta.skippedRecords++;
      continue;
    }

    if (wrapperType === 'event_msg') {
      const payload = asRec(rec.payload);
      const eventType = payload && str(payload.type);
      if (eventType === 'token_count') {
        const info = asRec(payload!.info);
        const totals = info && asRec(info.total_token_usage);
        if (totals) {
          const n = (k: string) => (typeof totals[k] === 'number' ? (totals[k] as number) : 0);
          // Cumulative totals — overwrite rather than accumulate.
          meta.usage = {
            inputTokens: n('input_tokens'),
            outputTokens: n('output_tokens'),
            cacheReadTokens: n('cached_input_tokens'),
            cacheCreationTokens: 0,
          } satisfies TraceUsage;
        }
      } else {
        meta.skippedRecords++; // agent_message/user_message duplicates, deltas, etc.
      }
      continue;
    }

    if (wrapperType === 'compacted') {
      const payload = asRec(rec.payload);
      turns.push({
        kind: 'system',
        line: lineNo,
        timestamp: ts,
        text: (payload && str(payload.message)) ?? '',
        thinkingChars: 0,
        toolCalls: [],
        isSidechain: false,
        isMeta: false,
        systemLabel: 'compacted',
        hasImages: false,
      });
      current = null;
      continue;
    }

    // Older rollouts: the response item sits at the top level.
    if (handleItem(rec, lineNo, ts)) continue;
    meta.skippedRecords++;
  }

  if (turns.length === 0) {
    errors.push({
      line: 1,
      column: 1,
      message: 'No renderable records found — is this a Codex rollout transcript?',
      severity: 'error',
    });
  }

  const ok = errors.filter((e) => e.severity === 'error').length === 0;
  const result: ParseResult = { ok, errors, stats: stats() };
  return { result, trace: ok ? { turns, meta } : null };
}
