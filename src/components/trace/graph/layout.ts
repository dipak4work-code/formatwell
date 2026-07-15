import type { TraceSession, TraceToolCall, TraceTurn } from '@/lib/parsers/agentTrace';

/**
 * Pure layout engine for the session graph. A transcript is a mostly-linear chain
 * (user → assistant → user → …) where assistant turns fan tool calls out to the
 * right and subagent (sidechain) blocks run in an offset column. That regularity
 * lets us compute positions directly — no force simulation or graph library.
 *
 * Coordinate space: arbitrary SVG units, origin top-left. The canvas fits/zooms.
 */

export type GraphNodeKind = 'user' | 'assistant' | 'system' | 'tool';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Primary label: "user" / model name / tool name / system subtype. */
  label: string;
  /** One-line truncated snippet under the label. */
  snippet: string;
  isSidechain: boolean;
  isError: boolean;
  /** Index into session.turns for turn nodes. */
  turnIndex?: number;
  /** For tool nodes: the tool call itself. */
  toolCall?: TraceToolCall;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: 'spine' | 'tool' | 'sidechain';
  isError: boolean;
}

export interface TraceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export const TURN_W = 250;
export const TURN_H = 54;
export const TOOL_W = 220;
export const TOOL_H = 32;
const GAP_Y = 18;
const TOOL_GAP_Y = 8;
const TOOL_OFFSET_X = 56;
const SIDECHAIN_OFFSET_X = 90;
const MARGIN = 24;

const SNIPPET_MAX = 46;

function snip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > SNIPPET_MAX ? `${flat.slice(0, SNIPPET_MAX)}…` : flat;
}

function turnLabel(turn: TraceTurn): string {
  if (turn.kind === 'user') return turn.isMeta ? 'meta' : 'user';
  if (turn.kind === 'assistant') {
    const model = turn.model ?? 'assistant';
    // Shorten "claude-fable-5" → "fable-5" style names to fit the node.
    return model.replace(/^claude-/, '');
  }
  return turn.systemLabel ?? 'system';
}

function turnSnippet(turn: TraceTurn): string {
  if (turn.text.trim()) return snip(turn.text);
  if (turn.toolCalls.length > 0)
    return `${turn.toolCalls.length} tool call${turn.toolCalls.length === 1 ? '' : 's'}`;
  if (turn.thinkingChars > 0) return `thought ${turn.thinkingChars.toLocaleString()} chars`;
  if (turn.hasImages) return '[image]';
  return '';
}

export function layoutTrace(session: TraceSession, showMeta = false): TraceGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  let y = MARGIN;
  let prevNodeId: string | null = null;
  let prevWasSidechain = false;
  /** Last main-spine node, so a sidechain block can branch from it and the spine can resume after. */
  let lastMainId: string | null = null;
  let maxRight = 0;

  const turns = showMeta
    ? session.turns
    : session.turns.filter((t) => !(t.kind === 'user' && t.isMeta));

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]!;
    const turnIndex = session.turns.indexOf(turn);
    const x = MARGIN + (turn.isSidechain ? SIDECHAIN_OFFSET_X : 0);
    const id = `t${turnIndex}`;

    const node: GraphNode = {
      id,
      kind: turn.kind,
      x,
      y,
      w: TURN_W,
      h: TURN_H,
      label: turnLabel(turn),
      snippet: turnSnippet(turn),
      isSidechain: turn.isSidechain,
      isError: turn.kind === 'system',
      turnIndex,
    };
    nodes.push(node);

    // Connect into the flow.
    if (turn.isSidechain && !prevWasSidechain) {
      // Sidechain block opens: branch off the last main node.
      if (lastMainId) {
        edges.push({ id: `e-${id}`, from: lastMainId, to: id, kind: 'sidechain', isError: false });
      }
    } else if (!turn.isSidechain && prevWasSidechain) {
      // Main spine resumes after a sidechain block.
      if (lastMainId) {
        edges.push({ id: `e-${id}`, from: lastMainId, to: id, kind: 'spine', isError: false });
      }
    } else if (prevNodeId) {
      edges.push({
        id: `e-${id}`,
        from: prevNodeId,
        to: id,
        kind: turn.isSidechain ? 'sidechain' : 'spine',
        isError: false,
      });
    }

    // Fan tool calls out to the right of the turn node.
    let toolY = y;
    const toolX = x + TURN_W + TOOL_OFFSET_X;
    for (let c = 0; c < turn.toolCalls.length; c++) {
      const call = turn.toolCalls[c]!;
      const toolId = `${id}c${c}`;
      const isError = call.result?.isError === true;
      nodes.push({
        id: toolId,
        kind: 'tool',
        x: toolX,
        y: toolY,
        w: TOOL_W,
        h: TOOL_H,
        label: call.name,
        snippet: snip(call.inputPreview),
        isSidechain: turn.isSidechain,
        isError,
        turnIndex,
        toolCall: call,
      });
      edges.push({ id: `e-${toolId}`, from: id, to: toolId, kind: 'tool', isError });
      maxRight = Math.max(maxRight, toolX + TOOL_W);
      toolY += TOOL_H + TOOL_GAP_Y;
    }

    maxRight = Math.max(maxRight, x + TURN_W);
    // Next row must clear both the turn node and its tool fan.
    y = Math.max(y + TURN_H, toolY) + GAP_Y;

    prevNodeId = id;
    prevWasSidechain = turn.isSidechain;
    if (!turn.isSidechain) lastMainId = id;
  }

  return {
    nodes,
    edges,
    width: maxRight + MARGIN,
    height: y - GAP_Y + MARGIN,
  };
}
