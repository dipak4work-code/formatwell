'use client';

import { useRef } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { ToolButton } from '@/components/ui/ToolButton';
import { copyToClipboard, downloadText, readClipboard, readTextFile } from '@/lib/utils/io';
import type { MarkdownStats } from '@/lib/markdown/stats';

interface MarkdownToolbarProps {
  source: string;
  onInsertText: (text: string) => void;
  onClear: () => void;
  sample: string;
  stats: MarkdownStats;
}

export function MarkdownToolbar({
  source,
  onInsertText,
  onClear,
  sample,
  stats,
}: MarkdownToolbarProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handlePaste() {
    const text = await readClipboard();
    if (text === null) {
      toast('Clipboard unavailable — paste with Ctrl+V', 'warn');
      return;
    }
    onInsertText(text);
    toast('Pasted', 'neutral');
  }

  async function handleFile(file: File) {
    const result = await readTextFile(file);
    if (!result.ok) {
      toast(result.error ?? 'Could not read file', 'invalid');
      return;
    }
    onInsertText(result.text ?? '');
    toast(result.warning ?? `Loaded ${file.name}`, result.warning ? 'warn' : 'neutral');
  }

  const hasContent = source.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToolButton onClick={handlePaste}>Paste</ToolButton>
      <ToolButton onClick={() => fileInputRef.current?.click()}>Upload</ToolButton>
      <ToolButton
        onClick={() => {
          onInsertText(sample);
          toast('Sample loaded', 'neutral');
        }}
      >
        Sample
      </ToolButton>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

      <ToolButton
        onClick={async () => {
          const { renderMarkdown } = await import('@/lib/markdown/render');
          const ok = await copyToClipboard(renderMarkdown(source));
          toast(ok ? 'Copied HTML' : 'Copy failed', ok ? 'valid' : 'invalid');
        }}
        disabled={!hasContent}
        title="Copy sanitized HTML"
      >
        Copy as HTML
      </ToolButton>
      <ToolButton
        onClick={() => {
          downloadText('document.md', source, 'text/markdown');
          toast('Downloaded', 'neutral');
        }}
        disabled={!hasContent}
      >
        Download .md
      </ToolButton>
      <ToolButton
        onClick={async () => {
          const { markdownToStandaloneHtml, inferTitle } = await import('@/lib/markdown/exportHtml');
          const title = inferTitle(source)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48);
          downloadText(`${title || 'document'}.html`, markdownToStandaloneHtml(source), 'text/html');
          toast('HTML downloaded', 'valid');
        }}
        disabled={!hasContent}
        title="Download as a self-contained, sanitized HTML file"
      >
        Download HTML
      </ToolButton>
      <ToolButton
        onClick={async () => {
          toast('Building PDF…', 'neutral');
          try {
            const { downloadMarkdownPdf } = await import('@/lib/markdown/exportPdf');
            await downloadMarkdownPdf(source);
            toast('PDF downloaded', 'valid');
          } catch {
            toast('PDF export failed', 'invalid');
          }
        }}
        disabled={!hasContent}
        title="Download as a formatted PDF document"
      >
        Download PDF
      </ToolButton>
      <ToolButton onClick={onClear}>Clear</ToolButton>

      <span
        className="ml-auto font-mono text-label text-muted"
        aria-label={`${stats.words} words, about ${stats.readingMinutes} minute read`}
      >
        {stats.words.toLocaleString()} word{stats.words === 1 ? '' : 's'} ·{' '}
        {stats.readingMinutes} min read
      </span>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
