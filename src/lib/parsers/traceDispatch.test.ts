import { describe, expect, it } from 'vitest';
import { detectTraceFormat, parseTrace } from './traceDispatch';
import { parseCodexTrace } from './codexTrace';
import { parseGenericTrace } from './genericTrace';
import { AGENT_TRACE_SAMPLE } from '@/lib/samples/agentTrace';
import { CODEX_TRACE_SAMPLE } from '@/lib/samples/codexTrace';

const GENERIC_SAMPLE = [
  '{"timestamp":"2026-07-16T10:00:00Z","message":{"role":"user","content":"list the files"}}',
  '{"timestamp":"2026-07-16T10:00:02Z","message":{"role":"assistant","model":"gpt-4o","content":"Listing now.","tool_calls":[{"id":"tc_1","type":"function","function":{"name":"ls","arguments":"{\\"path\\":\\".\\"}"}}]}}',
  '{"timestamp":"2026-07-16T10:00:03Z","message":{"role":"tool","tool_call_id":"tc_1","content":"a.txt\\nb.txt"}}',
  '{"timestamp":"2026-07-16T10:00:05Z","message":{"role":"assistant","content":"Two files: a.txt and b.txt."}}',
].join('\n');

describe('detectTraceFormat', () => {
  it('detects Claude Code sessions', () => {
    expect(detectTraceFormat(AGENT_TRACE_SAMPLE)).toBe('claude-code');
  });

  it('detects Codex rollouts', () => {
    expect(detectTraceFormat(CODEX_TRACE_SAMPLE)).toBe('codex');
  });

  it('detects legacy Codex markers (record_type / bare response items)', () => {
    expect(detectTraceFormat('{"record_type":"state","foo":1}')).toBe('codex');
    expect(
      detectTraceFormat('{"type":"function_call","name":"shell","arguments":"{}","call_id":"c1"}'),
    ).toBe('codex');
  });

  it('falls back to generic for role/content chat JSONL', () => {
    expect(detectTraceFormat(GENERIC_SAMPLE)).toBe('generic');
    expect(detectTraceFormat('{"role":"user","content":"hi"}')).toBe('generic');
  });

  it('returns null for unrecognizable content', () => {
    expect(detectTraceFormat('{"a":1}\n{"b":2}')).toBeNull();
  });
});

describe('parseTrace routing', () => {
  it('routes each sample to its adapter and tags meta.format', () => {
    expect(parseTrace(AGENT_TRACE_SAMPLE).trace?.meta.format).toBe('claude-code');
    expect(parseTrace(CODEX_TRACE_SAMPLE).trace?.meta.format).toBe('codex');
    expect(parseTrace(GENERIC_SAMPLE).trace?.meta.format).toBe('generic');
  });

  it('reports a located error for unrecognized input', () => {
    const { result, trace } = parseTrace('{"a":1}');
    expect(result.ok).toBe(false);
    expect(trace).toBeNull();
    expect(result.errors[0]!.message).toMatch(/unrecognized transcript format/i);
  });
});

describe('parseCodexTrace', () => {
  it('parses the Codex sample end to end', () => {
    const { result, trace } = parseCodexTrace(CODEX_TRACE_SAMPLE);
    expect(result.ok).toBe(true);
    const meta = trace!.meta;
    expect(meta.sessionId).toBe('0d9f1c2a-demo');
    expect(meta.version).toBe('0.48.0');
    expect(meta.gitBranch).toBe('main');
    expect(meta.models).toEqual(['gpt-5-codex']);
    expect(meta.userTurns).toBe(2);
    expect(meta.toolCalls).toBe(8);
    expect(meta.toolErrors).toBe(1); // exit_code 1 on the locked-database migration run
    // Cumulative token totals from the token_count event.
    expect(meta.usage.inputTokens).toBe(30480);
    expect(meta.usage.cacheReadTokens).toBe(26200);
    expect(meta.usage.outputTokens).toBe(2140);
  });

  it('links function_call to its output and flags exit_code errors', () => {
    const { trace } = parseCodexTrace(CODEX_TRACE_SAMPLE);
    const calls = trace!.turns.flatMap((t) => t.toolCalls);
    const failing = calls.find((c) => c.id === 'call_007')!;
    expect(failing.name).toBe('shell');
    expect(failing.result!.isError).toBe(true);
    expect(failing.result!.content).toContain('database is locked');
    const recovery = calls.find((c) => c.id === 'call_008')!;
    expect(recovery.result!.isError).toBe(false);
    expect(recovery.result!.content).toContain('Migrated');
    // Every call in the sample has a linked result.
    expect(calls.every((c) => c.result !== undefined)).toBe(true);
  });

  it('counts reasoning into thinkingChars, merges assistant text, and keeps system markers', () => {
    const { trace } = parseCodexTrace(CODEX_TRACE_SAMPLE);
    const assistants = trace!.turns.filter((t) => t.kind === 'assistant');
    expect(assistants.length).toBeGreaterThanOrEqual(2); // split by user turn + compaction
    expect(assistants[0]!.thinkingChars).toBeGreaterThan(0);
    expect(assistants[0]!.text).toContain('N+1');
    expect(assistants[0]!.model).toBe('gpt-5-codex');
    const compacted = trace!.turns.find((t) => t.kind === 'system')!;
    expect(compacted.systemLabel).toBe('compacted');
  });

  it('marks synthetic wrapper prompts as meta', () => {
    const src =
      '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"<environment_context>cwd=/x</environment_context>"}]}}\n' +
      '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"real question"}]}}';
    const { trace } = parseCodexTrace(src);
    expect(trace!.turns[0]!.isMeta).toBe(true);
    expect(trace!.turns[1]!.isMeta).toBe(false);
    expect(trace!.meta.userTurns).toBe(1);
  });
});

describe('parseGenericTrace', () => {
  it('parses chat JSONL with OpenAI-style tool_calls and tool results', () => {
    const { result, trace } = parseGenericTrace(GENERIC_SAMPLE);
    expect(result.ok).toBe(true);
    expect(trace!.meta.userTurns).toBe(1);
    expect(trace!.meta.toolCalls).toBe(1);
    expect(trace!.meta.models).toEqual(['gpt-4o']);
    const assistant = trace!.turns.find((t) => t.kind === 'assistant')!;
    expect(assistant.toolCalls[0]!.name).toBe('ls');
    expect(assistant.toolCalls[0]!.result!.content).toContain('a.txt');
  });

  it('handles top-level role/content lines and epoch timestamps', () => {
    const src = [
      '{"role":"user","content":"hello","ts":1789600000}',
      '{"role":"assistant","content":"hi there"}',
    ].join('\n');
    const { trace } = parseGenericTrace(src);
    expect(trace!.turns).toHaveLength(2);
    expect(trace!.meta.firstTimestamp).toBeDefined();
  });

  it('errors when nothing is chat-shaped', () => {
    const { result } = parseGenericTrace('{"a":1}');
    expect(result.ok).toBe(false);
  });
});
