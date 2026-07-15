import { edgePath, type GraphNode, type TraceGraph } from './layout';
import { downloadBlob } from '@/lib/utils/io';

/**
 * Graph → standalone image export. The live canvas paints with CSS variables, which
 * don't resolve inside a serialized SVG, so we snapshot the computed theme colors and
 * emit concrete values. Rendering happens on a local <canvas>; nothing leaves the page.
 */

interface ThemeColors {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  border: string;
  accent: string;
  invalid: string;
  warn: string;
}

const FONT = "ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Consolas, monospace";

function readTheme(el: Element): ThemeColors {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--bg', '#F7F8FA'),
    surface: v('--surface', '#FFFFFF'),
    ink: v('--ink', '#1E2230'),
    muted: v('--muted', '#5C6478'),
    border: v('--border', '#E3E6EE'),
    accent: v('--accent', '#3D5AFE'),
    invalid: v('--invalid', '#D93A4A'),
    warn: v('--warn', '#C77D00'),
  };
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nodeStroke(n: GraphNode, c: ThemeColors): string {
  if (n.isError) return c.invalid;
  if (n.kind === 'user') return c.accent;
  if (n.kind === 'system') return c.warn;
  return c.border;
}

function nodeLabelFill(n: GraphNode, c: ThemeColors): string {
  if (n.isError) return c.invalid;
  if (n.kind === 'user') return c.accent;
  if (n.kind === 'system') return c.warn;
  return c.ink;
}

export function graphToSvgString(graph: TraceGraph, colors: ThemeColors): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${graph.width}" height="${graph.height}" viewBox="0 0 ${graph.width} ${graph.height}" font-family="${esc(FONT)}">`,
    `<rect width="${graph.width}" height="${graph.height}" fill="${colors.bg}"/>`,
  );

  for (const e of graph.edges) {
    parts.push(
      `<path d="${edgePath(graph, e.from, e.to, e.kind)}" fill="none" stroke="${
        e.isError ? colors.invalid : colors.border
      }" stroke-width="${e.kind === 'spine' ? 2 : 1.25}"${
        e.kind === 'sidechain' ? ' stroke-dasharray="5 4"' : ''
      }/>`,
    );
  }

  for (const n of graph.nodes) {
    const isTool = n.kind === 'tool';
    parts.push(`<g transform="translate(${n.x} ${n.y})">`);
    parts.push(
      `<rect width="${n.w}" height="${n.h}" rx="${isTool ? 6 : 8}" fill="${colors.surface}" stroke="${nodeStroke(n, colors)}" stroke-width="1.5"/>`,
    );
    parts.push(
      `<text x="10" y="${isTool ? n.h / 2 + 4 : 20}" font-size="${isTool ? 11 : 12}" font-weight="600" fill="${nodeLabelFill(n, colors)}">${esc(n.label)}${isTool && n.isError ? ' ✗' : ''}</text>`,
    );
    if (!isTool && n.snippet) {
      parts.push(
        `<text x="10" y="38" font-size="10.5" fill="${colors.muted}">${esc(n.snippet)}</text>`,
      );
    }
    if (isTool && n.snippet) {
      const snippet = n.snippet.slice(0, Math.max(0, 30 - n.label.length));
      parts.push(
        `<text x="${10 + n.label.length * 7 + 10}" y="${n.h / 2 + 4}" font-size="10" fill="${colors.muted}">${esc(snippet)}</text>`,
      );
    }
    if (n.isSidechain && !isTool) {
      parts.push(`<circle cx="${n.w - 12}" cy="12" r="4" fill="${colors.accent}" opacity="0.6"/>`);
    }
    parts.push('</g>');
  }

  parts.push('</svg>');
  return parts.join('');
}

/** Keep the raster under browser canvas limits while preferring 2x sharpness. */
function pickScale(graph: TraceGraph): number {
  const MAX_DIM = 16000;
  const MAX_AREA = 120_000_000;
  let scale = 2;
  scale = Math.min(scale, MAX_DIM / graph.width, MAX_DIM / graph.height);
  const area = graph.width * graph.height;
  if (area * scale * scale > MAX_AREA) scale = Math.sqrt(MAX_AREA / area);
  return Math.max(0.4, Math.min(2, scale));
}

export async function downloadGraphPng(
  graph: TraceGraph,
  themeSource: Element,
  filename: string,
): Promise<void> {
  const svg = graphToSvgString(graph, readTheme(themeSource));
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();

  const scale = pickScale(graph);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(graph.width * scale);
  canvas.height = Math.round(graph.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG encoding failed');
  downloadBlob(filename, blob);
}
