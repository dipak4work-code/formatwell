import { describe, expect, it } from 'vitest';
import { parseAgentTrace } from './agentTrace';

const user = (text: string, extra: object = {}) =>
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2026-07-15T10:00:00Z',
    sessionId: 's-1',
    version: '2.0.0',
    gitBranch: 'main',
    cwd: 'd:/proj',
    message: { role: 'user', content: text },
    ...extra,
  });

const assistantBlocks = (blocks: unknown[], extra: object = {}) =>
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2026-07-15T10:00:05Z',
    message: {
      role: 'assistant',
      model: 'claude-fable-5',
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 5,
      },
      content: blocks,
    },
    ...extra,
  });

const toolResult = (id: string, content: string, isError = false) =>
  JSON.stringify({
    type: 'user',
    uuid: 'r1',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }],
    },
  });

describe('parseAgentTrace', () => {
  it('parses a user → assistant(text) exchange', () => {
    const src = [user('fix the bug'), assistantBlocks([{ type: 'text', text: 'Done.' }])].join(
      '\n',
    );
    const { result, trace } = parseAgentTrace(src);
    expect(result.ok).toBe(true);
    expect(trace!.turns.map((t) => t.kind)).toEqual(['user', 'assistant']);
    expect(trace!.turns[1]!.text).toBe('Done.');
    expect(trace!.meta.models).toEqual(['claude-fable-5']);
    expect(trace!.meta.usage.outputTokens).toBe(20);
  });

  it('links tool_use to its tool_result across lines', () => {
    const src = [
      user('run tests'),
      assistantBlocks([
        { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'npm test' } },
      ]),
      toolResult('toolu_1', 'all green'),
      assistantBlocks([{ type: 'text', text: 'Tests pass.' }]),
    ].join('\n');

    const { trace } = parseAgentTrace(src);
    const assistantTurns = trace!.turns.filter((t) => t.kind === 'assistant');
    // Consecutive assistant records merge into one turn (tool_result carrier doesn't split them).
    expect(assistantTurns).toHaveLength(1);
    const call = assistantTurns[0]!.toolCalls[0]!;
    expect(call.name).toBe('Bash');
    expect(call.result).toEqual({ content: 'all green', isError: false });
    expect(trace!.meta.toolCalls).toBe(1);
  });

  it('counts tool errors and thinking chars', () => {
    const src = [
      user('go'),
      assistantBlocks([
        { type: 'thinking', thinking: 'hmmmm', signature: 'x' },
        { type: 'tool_use', id: 'toolu_2', name: 'Read', input: { file_path: 'a.ts' } },
      ]),
      toolResult('toolu_2', 'File not found', true),
    ].join('\n');

    const { trace } = parseAgentTrace(src);
    const a = trace!.turns.find((t) => t.kind === 'assistant')!;
    expect(a.thinkingChars).toBe(5);
    expect(a.toolCalls[0]!.result!.isError).toBe(true);
    expect(trace!.meta.toolErrors).toBe(1);
  });

  it('skips non-renderable record types without failing', () => {
    const src = [
      JSON.stringify({ type: 'ai-title', sessionId: 's', aiTitle: 'T' }),
      JSON.stringify({ type: 'file-history-snapshot', messageId: 'm', snapshot: {} }),
      user('hello'),
      assistantBlocks([{ type: 'text', text: 'hi' }]),
      JSON.stringify({ type: 'mode', mode: 'default', sessionId: 's' }),
    ].join('\n');

    const { result, trace } = parseAgentTrace(src);
    expect(result.ok).toBe(true);
    expect(trace!.meta.skippedRecords).toBe(3);
    expect(trace!.turns).toHaveLength(2);
  });

  it('marks sidechain and meta turns', () => {
    const src = [
      user('main task'),
      assistantBlocks([{ type: 'text', text: 'spawning agent' }]),
      user('sub prompt', { isSidechain: true }),
      assistantBlocks([{ type: 'text', text: 'sub answer' }], { isSidechain: true }),
      user('<system-note/>', { isMeta: true }),
    ].join('\n');

    const { trace } = parseAgentTrace(src);
    expect(trace!.meta.sidechainTurns).toBe(2);
    expect(trace!.turns.filter((t) => t.isSidechain)).toHaveLength(2);
    // meta user turns don't count as human turns
    expect(trace!.meta.userTurns).toBe(2);
  });

  it('reports located errors for malformed lines but keeps parsing', () => {
    const src = [user('ok'), '{broken', assistantBlocks([{ type: 'text', text: 'fine' }])].join(
      '\n',
    );
    const { result } = parseAgentTrace(src);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({ line: 2, severity: 'error' });
  });

  it('rejects JSONL that is not a session transcript', () => {
    const { result, trace } = parseAgentTrace('{"a":1}\n{"b":2}');
    expect(result.ok).toBe(false);
    expect(trace).toBeNull();
    expect(result.errors[0]!.message).toMatch(/session transcript/i);
  });

  it('collects session metadata', () => {
    const src = [user('x'), assistantBlocks([{ type: 'text', text: 'y' }])].join('\n');
    const { trace } = parseAgentTrace(src);
    expect(trace!.meta.sessionId).toBe('s-1');
    expect(trace!.meta.gitBranch).toBe('main');
    expect(trace!.meta.version).toBe('2.0.0');
  });

  it('handles system records', () => {
    const src = [
      user('x'),
      JSON.stringify({ type: 'system', subtype: 'api_error', level: 'error', uuid: 'sy' }),
    ].join('\n');
    const { trace } = parseAgentTrace(src);
    const sys = trace!.turns.find((t) => t.kind === 'system')!;
    expect(sys.systemLabel).toBe('api_error (error)');
  });
});
