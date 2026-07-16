import type { TraceSession, TraceTurn } from '@/lib/parsers/agentTrace';
import { jpegPagesToPdf, type PdfPageImage } from '@/lib/pdf/pdfWriter';
import { downloadBlob } from '@/lib/utils/io';

/**
 * Step-by-step session report → PDF. Pages are composed on a canvas (so any unicode in
 * transcript data renders faithfully) and assembled by the dependency-free writer.
 * Always rendered on the light palette for print, regardless of the site theme.
 * Everything runs locally.
 */

// A4 at 96dpi CSS pixels, drawn at 2x for sharpness.
const PAGE_W = 794;
const PAGE_H = 1123;
const SCALE = 2;
const M = 56; // page margin
const CONTENT_W = PAGE_W - M * 2;

/** Cap per text block so a single huge tool result can't produce a 500-page PDF. */
const BLOCK_CHAR_CAP = 4000;

const C = {
  bg: '#FFFFFF',
  ink: '#1E2230',
  muted: '#5C6478',
  border: '#E3E6EE',
  accent: '#3D5AFE',
  invalid: '#D93A4A',
  warn: '#C77D00',
  codeBg: '#F3F4F8',
};

const MONO = "ui-monospace, 'Cascadia Mono', Consolas, monospace";

interface TextStyle {
  size: number;
  color: string;
  bold?: boolean;
  indent?: number;
  codeBg?: boolean;
}

function clean(text: string): string {
  // Drop control chars that canvas renders as tofu; keep newlines, expand tabs.
  let out = '';
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c === 9) {
      out += '  ';
      continue;
    }
    if ((c < 32 && c !== 10 && c !== 13) || c === 127) continue;
    out += ch;
  }
  return out;
}

function cap(text: string): string {
  if (text.length <= BLOCK_CHAR_CAP) return text;
  return `${text.slice(0, BLOCK_CHAR_CAP)}\n… [truncated ${(text.length - BLOCK_CHAR_CAP).toLocaleString()} of ${text.length.toLocaleString()} chars]`;
}

class PageComposer {
  pages: HTMLCanvasElement[] = [];
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private y = M;

  constructor() {
    this.newPage();
  }

  private font(style: TextStyle): string {
    return `${style.bold ? 600 : 400} ${style.size}px ${MONO}`;
  }

  newPage(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = PAGE_W * SCALE;
    this.canvas.height = PAGE_H * SCALE;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.textBaseline = 'alphabetic';
    this.pages.push(this.canvas);
    this.y = M;
  }

  private ensure(height: number): void {
    if (this.y + height > PAGE_H - M) this.newPage();
  }

  /** Footer page numbers, drawn once all pages exist. */
  finishFooters(): void {
    this.pages.forEach((page, i) => {
      const ctx = page.getContext('2d')!;
      ctx.save();
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.font = `400 9px ${MONO}`;
      ctx.fillStyle = C.muted;
      const label = `${i + 1} / ${this.pages.length}`;
      ctx.fillText(label, PAGE_W - M - ctx.measureText(label).width, PAGE_H - 24);
      ctx.fillText('validateformat.com/agent-trace', M, PAGE_H - 24);
      ctx.restore();
    });
  }

  gap(height: number): void {
    this.y += height;
  }

  rule(): void {
    this.ensure(12);
    this.ctx.strokeStyle = C.border;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(M, this.y + 4);
    this.ctx.lineTo(PAGE_W - M, this.y + 4);
    this.ctx.stroke();
    this.y += 12;
  }

  /** Single line with optional right-aligned suffix; no wrapping (caller pre-fits). */
  headerLine(text: string, style: TextStyle, right?: string): void {
    const lineH = style.size * 1.5;
    this.ensure(lineH);
    this.ctx.font = this.font(style);
    this.ctx.fillStyle = style.color;
    this.ctx.fillText(text, M + (style.indent ?? 0), this.y + style.size);
    if (right) {
      this.ctx.font = `400 ${style.size - 1}px ${MONO}`;
      this.ctx.fillStyle = C.muted;
      this.ctx.fillText(right, PAGE_W - M - this.ctx.measureText(right).width, this.y + style.size);
    }
    this.y += lineH;
  }

  /** Wrapped multi-line text; monospace char-count wrapping, page-break aware. */
  block(text: string, style: TextStyle): void {
    const indent = style.indent ?? 0;
    const lineH = style.size * 1.45;
    this.ctx.font = this.font(style);
    const charW = this.ctx.measureText('M').width;
    const perLine = Math.max(16, Math.floor((CONTENT_W - indent) / charW));

    const lines: string[] = [];
    for (const raw of cap(clean(text)).split('\n')) {
      if (raw.length <= perLine) lines.push(raw);
      else for (let i = 0; i < raw.length; i += perLine) lines.push(raw.slice(i, i + perLine));
    }

    for (const line of lines) {
      this.ensure(lineH);
      if (style.codeBg) {
        this.ctx.fillStyle = C.codeBg;
        this.ctx.fillRect(M + indent - 6, this.y + 2, CONTENT_W - indent + 12, lineH);
      }
      this.ctx.font = this.font(style);
      this.ctx.fillStyle = style.color;
      this.ctx.fillText(line, M + indent, this.y + style.size);
      this.y += lineH;
    }
  }
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(first?: string, last?: string): string {
  if (!first || !last) return '—';
  const ms = new Date(last).getTime() - new Date(first).getTime();
  if (!isFinite(ms) || ms < 0) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return `${Math.round(ms / 1000)}s`;
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function timeOf(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour12: false });
}

function turnHeading(turn: TraceTurn): { label: string; color: string } {
  if (turn.kind === 'user')
    return turn.isMeta
      ? { label: 'meta input', color: C.muted }
      : { label: 'user', color: C.accent };
  if (turn.kind === 'assistant')
    return { label: turn.model ?? 'assistant', color: C.ink };
  return { label: turn.systemLabel ?? 'system', color: C.warn };
}

function composeReport(trace: TraceSession, sourceName: string): PageComposer {
  const page = new PageComposer();
  const { meta } = trace;

  page.headerLine('Agent Trace — session report', { size: 19, color: C.ink, bold: true });
  page.gap(2);
  page.headerLine(sourceName || 'session transcript', { size: 11, color: C.muted });
  page.headerLine(`generated ${new Date().toLocaleString()}`, { size: 9, color: C.muted });
  page.gap(6);

  const metaLines = [
    `format: ${meta.format === 'claude-code' ? 'Claude Code' : meta.format === 'codex' ? 'Codex' : 'generic chat'}`,
    `turns: ${meta.userTurns} user · ${meta.assistantTurns} assistant`,
    `tool calls: ${meta.toolCalls} (${meta.toolErrors} error${meta.toolErrors === 1 ? '' : 's'})`,
    `tokens: ${fmtTokens(meta.usage.inputTokens)} in · ${fmtTokens(meta.usage.outputTokens)} out · ${fmtTokens(meta.usage.cacheReadTokens)} cache read`,
    `duration: ${fmtDuration(meta.firstTimestamp, meta.lastTimestamp)}`,
    meta.models.length ? `models: ${meta.models.join(', ')}` : '',
    meta.gitBranch ? `branch: ${meta.gitBranch}` : '',
    meta.sessionId ? `session: ${meta.sessionId}` : '',
  ].filter(Boolean);
  for (const line of metaLines) page.headerLine(line, { size: 10, color: C.ink });
  page.rule();
  page.gap(4);

  let step = 0;
  for (const turn of trace.turns) {
    step++;
    const { label, color } = turnHeading(turn);
    page.headerLine(
      `Step ${step} — ${label}${turn.isSidechain ? '  [subagent]' : ''}`,
      { size: 11, color, bold: true },
      timeOf(turn.timestamp),
    );

    if (turn.text.trim()) {
      page.block(turn.text, { size: 9.5, color: turn.isMeta ? C.muted : C.ink, indent: 14 });
    }
    if (turn.thinkingChars > 0) {
      page.headerLine(`(thought for ${turn.thinkingChars.toLocaleString()} characters)`, {
        size: 9,
        color: C.muted,
        indent: 14,
      });
    }
    if (turn.usage) {
      page.headerLine(
        `tokens: ${turn.usage.inputTokens} in · ${turn.usage.outputTokens} out`,
        { size: 8.5, color: C.muted, indent: 14 },
      );
    }

    for (const call of turn.toolCalls) {
      step++;
      const failed = call.result?.isError === true;
      page.gap(3);
      page.headerLine(`Step ${step} — tool: ${call.name}${failed ? '  ✗ error' : ''}`, {
        size: 10.5,
        color: failed ? C.invalid : C.ink,
        bold: true,
        indent: 14,
      });
      page.headerLine('input', { size: 8.5, color: C.muted, indent: 26 });
      page.block(call.input, { size: 9, color: C.ink, indent: 26, codeBg: true });
      if (call.result) {
        page.gap(2);
        page.headerLine(failed ? 'result (error)' : 'result', {
          size: 8.5,
          color: failed ? C.invalid : C.muted,
          indent: 26,
        });
        page.block(call.result.content || '(empty)', {
          size: 9,
          color: failed ? C.invalid : C.ink,
          indent: 26,
          codeBg: true,
        });
      } else {
        page.headerLine('(no result recorded)', { size: 8.5, color: C.muted, indent: 26 });
      }
    }

    page.gap(10);
  }

  page.finishFooters();
  return page;
}

function canvasToJpeg(canvas: HTMLCanvasElement): PdfPageImage {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { data: bytes, width: canvas.width, height: canvas.height };
}

export async function downloadTraceReportPdf(
  trace: TraceSession,
  sourceName: string,
): Promise<void> {
  const composer = composeReport(trace, sourceName);
  const images = composer.pages.map(canvasToJpeg);
  const blob = jpegPagesToPdf(images);
  const base = (sourceName || 'agent-trace').replace(/\.(jsonl|ndjson|txt)$/i, '');
  downloadBlob(`${base}-report.pdf`, blob);
}
