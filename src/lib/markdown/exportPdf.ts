import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { jpegPagesToPdf, type PdfPageImage } from '@/lib/pdf/pdfWriter';
import { downloadBlob } from '@/lib/utils/io';
import { inferTitle } from './exportHtml';

/**
 * Markdown → PDF, fully client-side. The document is tokenized with markdown-it,
 * flattened to a small block model (pure + unit-testable), then composed onto A4
 * canvas pages (unicode-safe, light palette) and assembled by the shared PDF writer.
 */

// ---------- Block model (pure) ----------------------------------------------------

export interface Seg {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type MdBlock =
  | { kind: 'heading'; level: number; segs: Seg[] }
  | { kind: 'para'; segs: Seg[]; indent: number; quote: boolean; marker?: string }
  | { kind: 'code'; text: string }
  | { kind: 'table-row'; cells: string[]; header: boolean }
  | { kind: 'hr' };

const md = new MarkdownIt({ html: false, linkify: true });

/** Flatten markdown-it inline children into styled segments. */
function flattenInline(children: Token[] | null): Seg[] {
  const segs: Seg[] = [];
  let bold = false;
  let italic = false;
  let linkHref = '';
  for (const t of children ?? []) {
    switch (t.type) {
      case 'text':
        if (t.content) segs.push({ text: t.content, bold, italic });
        break;
      case 'code_inline':
        segs.push({ text: t.content, code: true });
        break;
      case 'strong_open':
        bold = true;
        break;
      case 'strong_close':
        bold = false;
        break;
      case 'em_open':
        italic = true;
        break;
      case 'em_close':
        italic = false;
        break;
      case 'link_open':
        linkHref = t.attrGet('href') ?? '';
        break;
      case 'link_close':
        if (linkHref && !linkHref.startsWith('#')) {
          segs.push({ text: ` (${linkHref})`, italic: true });
        }
        linkHref = '';
        break;
      case 'image':
        segs.push({ text: `[image: ${t.content || 'untitled'}]`, italic: true });
        break;
      case 'softbreak':
        segs.push({ text: ' ' });
        break;
      case 'hardbreak':
        segs.push({ text: '\n' });
        break;
      case 'html_inline':
        if (t.content) segs.push({ text: t.content, code: true });
        break;
      default:
        break;
    }
  }
  return segs;
}

function segsText(segs: Seg[]): string {
  return segs.map((s) => s.text).join('');
}

/** Tokenize markdown and flatten to renderable blocks. Pure — safe to unit test. */
export function markdownToBlocks(source: string): MdBlock[] {
  const tokens = md.parse(source, {});
  const blocks: MdBlock[] = [];

  let quoteDepth = 0;
  const listStack: Array<{ ordered: boolean; index: number }> = [];
  /** Pending list-item marker, consumed by the item's first paragraph. */
  let pendingMarker: string | undefined;
  let inHeader = false;
  let row: string[] | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    switch (t.type) {
      case 'heading_open': {
        const inline = tokens[i + 1];
        blocks.push({
          kind: 'heading',
          level: Number(t.tag.slice(1)) || 1,
          segs: flattenInline(inline?.children ?? null),
        });
        i += 2; // inline + heading_close
        break;
      }
      case 'paragraph_open': {
        const inline = tokens[i + 1];
        blocks.push({
          kind: 'para',
          segs: flattenInline(inline?.children ?? null),
          indent: listStack.length,
          quote: quoteDepth > 0,
          marker: pendingMarker,
        });
        pendingMarker = undefined;
        i += 2;
        break;
      }
      case 'fence':
      case 'code_block':
      case 'html_block':
        blocks.push({ kind: 'code', text: t.content.replace(/\n$/, '') });
        break;
      case 'blockquote_open':
        quoteDepth++;
        break;
      case 'blockquote_close':
        quoteDepth = Math.max(0, quoteDepth - 1);
        break;
      case 'bullet_list_open':
        listStack.push({ ordered: false, index: 0 });
        break;
      case 'ordered_list_open':
        listStack.push({ ordered: true, index: Number(t.attrGet('start') ?? 1) - 1 });
        break;
      case 'bullet_list_close':
      case 'ordered_list_close':
        listStack.pop();
        break;
      case 'list_item_open': {
        const top = listStack[listStack.length - 1];
        if (top) {
          top.index++;
          pendingMarker = top.ordered ? `${top.index}.` : '•';
        }
        break;
      }
      case 'hr':
        blocks.push({ kind: 'hr' });
        break;
      case 'thead_open':
        inHeader = true;
        break;
      case 'thead_close':
        inHeader = false;
        break;
      case 'tr_open':
        row = [];
        break;
      case 'tr_close':
        if (row) blocks.push({ kind: 'table-row', cells: row, header: inHeader });
        row = null;
        break;
      case 'th_open':
      case 'td_open': {
        const inline = tokens[i + 1];
        row?.push(segsText(flattenInline(inline?.children ?? null)));
        i += 2;
        break;
      }
      default:
        break;
    }
  }
  return blocks;
}

// ---------- Canvas composition (browser only) --------------------------------------

const PAGE_W = 794;
const PAGE_H = 1123;
const SCALE = 2;
const MARGIN = 64;
const CONTENT_W = PAGE_W - MARGIN * 2;

const C = {
  bg: '#FFFFFF',
  ink: '#1E2230',
  muted: '#5C6478',
  border: '#E3E6EE',
  codeBg: '#F3F4F8',
  accent: '#3D5AFE',
};

const SANS = "ui-sans-serif, system-ui, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, 'Cascadia Mono', Consolas, monospace";

const HEADING_SIZES: Record<number, number> = { 1: 21, 2: 17, 3: 14.5, 4: 12.5, 5: 11.5, 6: 11 };

interface Run {
  text: string;
  font: string;
  color: string;
  width: number;
}

function segFont(seg: Seg, size: number, baseBold: boolean): string {
  const bold = seg.bold || baseBold ? 600 : 400;
  const italic = seg.italic ? 'italic ' : '';
  const family = seg.code ? MONO : SANS;
  const sz = seg.code ? size * 0.92 : size;
  return `${italic}${bold} ${sz}px ${family}`;
}

class MdComposer {
  pages: HTMLCanvasElement[] = [];
  private ctx!: CanvasRenderingContext2D;
  private y = MARGIN;

  constructor() {
    this.newPage();
  }

  newPage(): void {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W * SCALE;
    canvas.height = PAGE_H * SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    this.ctx = ctx;
    this.pages.push(canvas);
    this.y = MARGIN;
  }

  private ensure(h: number): void {
    if (this.y + h > PAGE_H - MARGIN) this.newPage();
  }

  gap(h: number): void {
    this.y += h;
  }

  rule(): void {
    this.ensure(14);
    this.ctx.strokeStyle = C.border;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(MARGIN, this.y + 6);
    this.ctx.lineTo(PAGE_W - MARGIN, this.y + 6);
    this.ctx.stroke();
    this.y += 14;
  }

  /** Greedy word-wrap of styled segments; draws line by line with page breaks. */
  segs(
    segs: Seg[],
    size: number,
    opts: { indent?: number; quote?: boolean; marker?: string; baseBold?: boolean } = {},
  ): void {
    const baseIndent = MARGIN + (opts.indent ?? 0);
    const markerWidth = opts.marker ? 22 : 0;
    const quoteInset = opts.quote ? 14 : 0;
    const x0 = baseIndent + quoteInset + markerWidth;
    const maxW = PAGE_W - MARGIN - x0;
    const lineH = size * 1.55;

    // Tokenize into words (keeping trailing spaces) per segment.
    const words: Array<{ text: string; seg: Seg }> = [];
    for (const seg of segs) {
      for (const part of seg.text.split(/(\n)/)) {
        if (part === '\n') words.push({ text: '\n', seg });
        else if (part) for (const w of part.match(/\S+\s*|\s+/g) ?? []) words.push({ text: w, seg });
      }
    }

    const lines: Run[][] = [];
    let line: Run[] = [];
    let width = 0;
    const flush = () => {
      lines.push(line);
      line = [];
      width = 0;
    };
    for (const w of words) {
      if (w.text === '\n') {
        flush();
        continue;
      }
      const font = segFont(w.seg, size, opts.baseBold ?? false);
      this.ctx.font = font;
      const wWidth = this.ctx.measureText(w.text).width;
      if (width + wWidth > maxW && line.length > 0) flush();
      line.push({
        text: w.text,
        font,
        color: w.seg.code ? C.ink : w.seg.italic && !w.seg.bold ? C.muted : C.ink,
        width: wWidth,
      });
      width += wWidth;
    }
    if (line.length > 0 || lines.length === 0) flush();

    lines.forEach((runs, li) => {
      this.ensure(lineH);
      if (opts.quote) {
        this.ctx.fillStyle = C.accent;
        this.ctx.fillRect(baseIndent, this.y + 2, 2.5, lineH);
      }
      if (li === 0 && opts.marker) {
        this.ctx.font = `400 ${size}px ${SANS}`;
        this.ctx.fillStyle = C.muted;
        this.ctx.fillText(opts.marker, baseIndent + quoteInset, this.y + size);
      }
      let x = x0;
      for (const run of runs) {
        if (run.font.includes(MONO)) {
          this.ctx.fillStyle = C.codeBg;
          this.ctx.fillRect(x - 1, this.y + 1, run.width + 2, lineH - 2);
        }
        this.ctx.font = run.font;
        this.ctx.fillStyle = run.color;
        this.ctx.fillText(run.text, x, this.y + size);
        x += run.width;
      }
      this.y += lineH;
    });
  }

  codeBlock(text: string): void {
    const size = 9;
    const lineH = size * 1.55;
    this.ctx.font = `400 ${size}px ${MONO}`;
    const charW = this.ctx.measureText('M').width;
    const perLine = Math.max(20, Math.floor((CONTENT_W - 24) / charW));

    this.gap(4);
    for (const raw of text.split('\n')) {
      const chunks = raw.length <= perLine ? [raw] : (raw.match(new RegExp(`.{1,${perLine}}`, 'g')) ?? ['']);
      for (const chunk of chunks) {
        this.ensure(lineH);
        this.ctx.fillStyle = C.codeBg;
        this.ctx.fillRect(MARGIN, this.y, CONTENT_W, lineH);
        this.ctx.font = `400 ${size}px ${MONO}`;
        this.ctx.fillStyle = C.ink;
        this.ctx.fillText(chunk, MARGIN + 12, this.y + size + 1);
        this.y += lineH;
      }
    }
    this.gap(6);
  }

  tableRow(cells: string[], widths: number[], header: boolean): void {
    const size = 9.5;
    const lineH = size * 1.7;
    this.ensure(lineH);
    this.ctx.font = `${header ? 600 : 400} ${size}px ${MONO}`;
    this.ctx.fillStyle = C.ink;
    let x = MARGIN;
    cells.forEach((cell, i) => {
      const w = widths[i] ?? 12;
      const clipped = cell.length > w ? `${cell.slice(0, w - 1)}…` : cell;
      this.ctx.fillText(clipped, x, this.y + size);
      x += (w + 2) * this.ctx.measureText('M').width;
    });
    this.y += lineH;
    if (header) {
      this.ctx.strokeStyle = C.border;
      this.ctx.beginPath();
      this.ctx.moveTo(MARGIN, this.y);
      this.ctx.lineTo(Math.min(x, PAGE_W - MARGIN), this.y);
      this.ctx.stroke();
      this.y += 3;
    }
  }

  finishFooters(): void {
    this.pages.forEach((page, i) => {
      const ctx = page.getContext('2d')!;
      ctx.save();
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.font = `400 9px ${MONO}`;
      ctx.fillStyle = C.muted;
      const label = `${i + 1} / ${this.pages.length}`;
      ctx.fillText(label, PAGE_W - MARGIN - ctx.measureText(label).width, PAGE_H - 28);
      ctx.fillText('validateformat.com/markdown', MARGIN, PAGE_H - 28);
      ctx.restore();
    });
  }
}

function compose(blocks: MdBlock[]): MdComposer {
  const page = new MdComposer();

  // Column widths per table are derived from the rows that form a contiguous run.
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    switch (b.kind) {
      case 'heading': {
        page.gap(b.level <= 2 ? 14 : 10);
        page.segs(b.segs, HEADING_SIZES[b.level] ?? 11, { baseBold: true });
        page.gap(2);
        if (b.level === 1) page.rule();
        break;
      }
      case 'para':
        page.segs(b.segs, 10.5, {
          indent: b.indent * 18,
          quote: b.quote,
          marker: b.marker,
        });
        page.gap(4);
        break;
      case 'code':
        page.codeBlock(b.text);
        break;
      case 'hr':
        page.rule();
        break;
      case 'table-row': {
        // Gather the whole table run to size columns consistently.
        const rows: Array<{ cells: string[]; header: boolean }> = [];
        let j = i;
        while (j < blocks.length && blocks[j]!.kind === 'table-row') {
          const r = blocks[j] as { cells: string[]; header: boolean };
          rows.push(r);
          j++;
        }
        const cols = Math.max(...rows.map((r) => r.cells.length));
        const widths: number[] = [];
        for (let c = 0; c < cols; c++) {
          widths.push(Math.min(30, Math.max(6, ...rows.map((r) => (r.cells[c] ?? '').length))));
        }
        page.gap(4);
        for (const r of rows) page.tableRow(r.cells, widths, r.header);
        page.gap(6);
        i = j - 1;
        break;
      }
    }
  }

  page.finishFooters();
  return page;
}

function canvasToJpeg(canvas: HTMLCanvasElement): PdfPageImage {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { data: bytes, width: canvas.width, height: canvas.height };
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'document';
}

export async function downloadMarkdownPdf(source: string): Promise<void> {
  const blocks = markdownToBlocks(source);
  const composer = compose(blocks);
  const blob = jpegPagesToPdf(composer.pages.map(canvasToJpeg));
  downloadBlob(`${slugify(inferTitle(source))}.pdf`, blob);
}
