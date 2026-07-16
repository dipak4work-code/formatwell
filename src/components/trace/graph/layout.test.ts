import { describe, expect, it } from 'vitest';
import { layoutTrace, TURN_H } from './layout';
import { parseAgentTrace } from '@/lib/parsers/agentTrace';
import { AGENT_TRACE_SAMPLE } from '@/lib/samples/agentTrace';

function sampleSession() {
  const { trace } = parseAgentTrace(AGENT_TRACE_SAMPLE);
  if (!trace) throw new Error('sample must parse');
  return trace;
}

describe('layoutTrace', () => {
  it('creates a node per turn and per tool call (meta turns included with showMeta)', () => {
    const session = sampleSession();
    const g = layoutTrace(session, true);
    const turnNodes = g.nodes.filter((n) => n.kind !== 'tool');
    const toolNodes = g.nodes.filter((n) => n.kind === 'tool');
    expect(turnNodes).toHaveLength(session.turns.length);
    expect(toolNodes).toHaveLength(session.meta.toolCalls);

    // Default view hides meta user turns.
    const metaTurns = session.turns.filter((t) => t.kind === 'user' && t.isMeta).length;
    expect(metaTurns).toBeGreaterThan(0); // the sample demonstrates the toggle
    const defaultTurnNodes = layoutTrace(session).nodes.filter((n) => n.kind !== 'tool');
    expect(defaultTurnNodes).toHaveLength(session.turns.length - metaTurns);
  });

  it('lays turns top-down without overlaps', () => {
    const g = layoutTrace(sampleSession());
    const turnNodes = g.nodes.filter((n) => n.kind !== 'tool');
    for (let i = 1; i < turnNodes.length; i++) {
      expect(turnNodes[i]!.y).toBeGreaterThanOrEqual(turnNodes[i - 1]!.y + TURN_H);
    }
  });

  it('offsets sidechain turns and places tool nodes to the right of their turn', () => {
    const g = layoutTrace(sampleSession());
    const main = g.nodes.find((n) => n.kind === 'user' && !n.isSidechain)!;
    const side = g.nodes.find((n) => n.kind === 'user' && n.isSidechain)!;
    expect(side.x).toBeGreaterThan(main.x);

    for (const tool of g.nodes.filter((n) => n.kind === 'tool')) {
      const parent = g.nodes.find((n) => n.turnIndex === tool.turnIndex && n.kind !== 'tool')!;
      expect(tool.x).toBeGreaterThan(parent.x + parent.w);
    }
  });

  it('marks failed tool calls as error nodes and edges', () => {
    const g = layoutTrace(sampleSession());
    const errNodes = g.nodes.filter((n) => n.kind === 'tool' && n.isError);
    expect(errNodes.length).toBeGreaterThanOrEqual(1);
    const errEdge = g.edges.find((e) => e.to === errNodes[0]!.id)!;
    expect(errEdge.isError).toBe(true);
  });

  it('every edge endpoint refers to an existing node', () => {
    const g = layoutTrace(sampleSession());
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it('branches sidechain from the main spine and resumes after', () => {
    const g = layoutTrace(sampleSession());
    const sidechainEdges = g.edges.filter((e) => e.kind === 'sidechain');
    expect(sidechainEdges.length).toBeGreaterThanOrEqual(1);
    // The resume edge exists: a spine edge whose target is a main node positioned after side nodes.
    const sideMaxY = Math.max(...g.nodes.filter((n) => n.isSidechain).map((n) => n.y));
    const resume = g.nodes.find((n) => !n.isSidechain && n.kind !== 'tool' && n.y > sideMaxY);
    expect(resume).toBeDefined();
  });

  it('orders nodes as turn followed by its tool calls (playback reveal order)', () => {
    const g = layoutTrace(sampleSession());
    let lastTurnIndex = -1;
    for (const n of g.nodes) {
      if (n.kind !== 'tool') {
        expect(n.turnIndex!).toBeGreaterThan(lastTurnIndex);
        lastTurnIndex = n.turnIndex!;
      } else {
        // Tool nodes always belong to the most recently emitted turn.
        expect(n.turnIndex).toBe(lastTurnIndex);
      }
    }
  });

  it('honors showMeta=false by omitting meta user turns', () => {
    const withMetaLine = [
      AGENT_TRACE_SAMPLE,
      '{"type":"user","uuid":"m-extra","isMeta":true,"message":{"role":"user","content":"<local-command-stdout>x</local-command-stdout>"}}',
    ].join('\n');
    const { trace } = parseAgentTrace(withMetaLine);
    const metaTurns = trace!.turns.filter((t) => t.kind === 'user' && t.isMeta).length;
    const hidden = layoutTrace(trace!, false);
    const shown = layoutTrace(trace!, true);
    expect(shown.nodes.length).toBe(hidden.nodes.length + metaTurns);
  });
});
