'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { edgePath, type GraphNode, type TraceGraph as Graph } from './layout';
import { downloadGraphPng } from './exportImage';
import { useToast } from '@/components/ui/ToastProvider';

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;

function nodeStroke(node: GraphNode, selected: boolean): string {
  if (selected) return 'var(--accent)';
  if (node.isError) return 'var(--invalid)';
  if (node.kind === 'user') return 'var(--accent)';
  if (node.kind === 'system') return 'var(--warn)';
  return 'var(--border)';
}

interface TraceGraphViewProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (node: GraphNode | null) => void;
  /** Changes when a NEW source loads — triggers fit-to-view. Live re-parses keep it stable. */
  fitKey?: number;
  /** Live mode: keep the newest node in view as the graph grows. */
  followTail?: boolean;
  /** Base filename (without extension) for image export. */
  exportName?: string;
  /** Playback: render only the first N nodes (undefined = all). */
  revealCount?: number;
}

export function TraceGraphView({
  graph,
  selectedId,
  onSelect,
  fitKey = 0,
  followTail = false,
  exportName = 'agent-trace',
  revealCount,
}: TraceGraphViewProps) {
  const { toast } = useToast();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);

  const graphRef = useRef(graph);
  graphRef.current = graph;

  const playback = revealCount !== undefined;
  const visibleNodes = useMemo(
    () => (playback ? graph.nodes.slice(0, revealCount) : graph.nodes),
    [graph, playback, revealCount],
  );
  const visibleEdges = useMemo(() => {
    if (!playback) return graph.edges;
    const ids = new Set(visibleNodes.map((n) => n.id));
    return graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  }, [graph, playback, visibleNodes]);
  /** The most recently revealed node — highlighted and kept in view during playback. */
  const stepNode = playback && visibleNodes.length > 0 ? visibleNodes[visibleNodes.length - 1] : null;

  const fit = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const g = graphRef.current;
    const { clientWidth, clientHeight } = host;
    if (clientWidth === 0) return;
    const scale = Math.min(
      Math.max(Math.min(clientWidth / g.width, clientHeight / g.height), MIN_SCALE),
      1,
    );
    setViewport({ x: (clientWidth - g.width * scale) / 2, y: 8, scale });
  }, []);

  // Fit only when a new source loads — not on every live growth of the same session.
  useEffect(() => {
    fit();
  }, [fitKey, fit]);

  // Live follow: as the graph grows, keep its tail visible (preserving x/scale).
  useEffect(() => {
    if (!followTail || playback) return;
    const host = hostRef.current;
    if (!host) return;
    setViewport((v) => {
      const targetY = host.clientHeight - graph.height * v.scale - 16;
      return targetY < v.y ? { ...v, y: targetY } : v;
    });
  }, [graph.height, followTail, playback]);

  // Playback follow: keep the newest revealed node comfortably in view (preserve scale).
  const stepId = stepNode?.id;
  useEffect(() => {
    if (!stepId) return;
    const host = hostRef.current;
    const node = graphRef.current.nodes.find((n) => n.id === stepId);
    if (!host || !node) return;
    setViewport((v) => {
      const pad = 60;
      const nx = node.x * v.scale + v.x;
      const ny = node.y * v.scale + v.y;
      const nx2 = (node.x + node.w) * v.scale + v.x;
      const ny2 = (node.y + node.h) * v.scale + v.y;
      let { x, y } = v;
      if (ny2 > host.clientHeight - pad) y -= ny2 - (host.clientHeight - pad);
      if (ny < pad) y += pad - ny;
      if (nx2 > host.clientWidth - pad) x -= nx2 - (host.clientWidth - pad);
      if (nx < pad) x += pad - nx;
      return x === v.x && y === v.y ? v : { ...v, x, y };
    });
  }, [stepId]);

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    setViewport((v) => {
      const scale = Math.min(Math.max(v.scale * factor, MIN_SCALE), MAX_SCALE);
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }

  function zoomCenter(factor: number) {
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, vx: viewport.x, vy: viewport.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setViewport((v) => ({
      ...v,
      x: d.vx + (e.clientX - d.startX),
      y: d.vy + (e.clientY - d.startY),
    }));
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    // Treat a no-movement pointerup on the background as "deselect".
    if (d && Math.abs(e.clientX - d.startX) < 4 && Math.abs(e.clientY - d.startY) < 4) {
      if ((e.target as Element).tagName === 'svg') onSelect(null);
    }
  }

  return (
    <div
      ref={hostRef}
      className="relative h-full min-h-[420px] touch-none select-none overflow-hidden rounded-md bg-bg"
    >
      <svg
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="img"
        aria-label="Session graph"
      >
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
          {visibleEdges.map((e) => (
            <path
              key={e.id}
              d={edgePath(graph, e.from, e.to, e.kind)}
              fill="none"
              stroke={e.isError ? 'var(--invalid)' : 'var(--border)'}
              strokeWidth={e.kind === 'spine' ? 2 : 1.25}
              strokeDasharray={e.kind === 'sidechain' ? '5 4' : undefined}
            />
          ))}

          {visibleNodes.map((n) => {
            const selected = n.id === selectedId;
            const isStep = n.id === stepNode?.id;
            const isTool = n.kind === 'tool';
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                className="cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSelect(n)}
                tabIndex={0}
                role="button"
                aria-label={`${n.label}: ${n.snippet}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect(n);
                }}
              >
                {isStep && (
                  <rect
                    x={-4}
                    y={-4}
                    width={n.w + 8}
                    height={n.h + 8}
                    rx={isTool ? 9 : 11}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    opacity={0.55}
                    className="animate-pulse"
                  />
                )}
                <rect
                  width={n.w}
                  height={n.h}
                  rx={isTool ? 6 : 8}
                  fill="var(--surface)"
                  stroke={nodeStroke(n, selected)}
                  strokeWidth={selected ? 2.5 : 1.5}
                />
                <text
                  x={10}
                  y={isTool ? n.h / 2 + 4 : 20}
                  fontFamily="var(--font-mono), monospace"
                  fontSize={isTool ? 11 : 12}
                  fontWeight={600}
                  fill={
                    n.isError
                      ? 'var(--invalid)'
                      : n.kind === 'user'
                        ? 'var(--accent)'
                        : n.kind === 'system'
                          ? 'var(--warn)'
                          : 'var(--ink)'
                  }
                >
                  {n.label}
                  {isTool && n.isError ? ' ✗' : ''}
                </text>
                {!isTool && n.snippet && (
                  <text
                    x={10}
                    y={38}
                    fontFamily="var(--font-mono), monospace"
                    fontSize={10.5}
                    fill="var(--muted)"
                  >
                    {n.snippet}
                  </text>
                )}
                {isTool && n.snippet && (
                  <text
                    x={10 + n.label.length * 7 + 10}
                    y={n.h / 2 + 4}
                    fontFamily="var(--font-mono), monospace"
                    fontSize={10}
                    fill="var(--muted)"
                  >
                    {n.snippet.slice(0, Math.max(0, 30 - n.label.length))}
                  </text>
                )}
                {n.isSidechain && !isTool && (
                  <circle cx={n.w - 12} cy={12} r={4} fill="var(--accent)" opacity={0.6} />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-3 right-3 flex gap-1">
        {[
          {
            label: 'PNG ↓',
            act: () => {
              const host = hostRef.current;
              if (!host) return;
              downloadGraphPng(graphRef.current, host, `${exportName}.png`)
                .then(() => toast('Graph image downloaded', 'valid'))
                .catch(() => toast('Image export failed', 'invalid'));
            },
            aria: 'Download graph as PNG image',
          },
          { label: '−', act: () => zoomCenter(1 / 1.3), aria: 'Zoom out' },
          { label: '+', act: () => zoomCenter(1.3), aria: 'Zoom in' },
          { label: 'Fit', act: fit, aria: 'Fit graph to view' },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            aria-label={b.aria}
            onClick={b.act}
            className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-label text-muted transition-colors duration-fade hover:border-accent hover:text-ink"
          >
            {b.label}
          </button>
        ))}
      </div>

      <p className="pointer-events-none absolute left-3 top-2 font-mono text-[10px] text-muted">
        drag to pan · scroll to zoom · click a node
      </p>
    </div>
  );
}
