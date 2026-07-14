'use client';

import { useRef } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { ToolButton } from '@/components/ui/ToolButton';
import { copyToClipboard, downloadText, readClipboard, readTextFile } from '@/lib/utils/io';

interface EditorToolbarProps {
  /** Replace editor content — used by Paste, Upload, and Sample. */
  onInsertText: (text: string) => void;
  onValidate: () => void;
  onFormat: () => void;
  /** When provided, a Minify button appears (JSON/XML only). */
  onMinify?: () => void;
  onClear: () => void;
  /** Current output used by Copy output / Download output. */
  output?: string;
  /** Sample payload; when provided, a Sample button appears. */
  sample?: string;
  downloadName?: string;
  downloadMime?: string;
  disabled?: boolean;
}

export function EditorToolbar({
  onInsertText,
  onValidate,
  onFormat,
  onMinify,
  onClear,
  output,
  sample,
  downloadName = 'output.txt',
  downloadMime = 'text/plain',
  disabled = false,
}: EditorToolbarProps) {
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

  const hasOutput = Boolean(output && output.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToolButton onClick={onValidate} disabled={disabled} primary>
        Validate
      </ToolButton>
      <ToolButton onClick={onFormat} disabled={disabled}>
        Format
      </ToolButton>
      {onMinify && (
        <ToolButton onClick={onMinify} disabled={disabled}>
          Minify
        </ToolButton>
      )}

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

      <ToolButton onClick={handlePaste} disabled={disabled}>
        Paste
      </ToolButton>
      <ToolButton onClick={() => fileInputRef.current?.click()} disabled={disabled}>
        Upload
      </ToolButton>
      {sample !== undefined && (
        <ToolButton
          onClick={() => {
            onInsertText(sample);
            toast('Sample loaded', 'neutral');
          }}
          disabled={disabled}
        >
          Sample
        </ToolButton>
      )}

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

      <ToolButton
        onClick={async () => {
          const ok = await copyToClipboard(output ?? '');
          toast(ok ? 'Copied' : 'Copy failed', ok ? 'valid' : 'invalid');
        }}
        disabled={disabled || !hasOutput}
      >
        Copy output
      </ToolButton>
      <ToolButton
        onClick={() => {
          downloadText(downloadName, output ?? '', downloadMime);
          toast('Downloaded', 'neutral');
        }}
        disabled={disabled || !hasOutput}
      >
        Download
      </ToolButton>
      <ToolButton
        onClick={() => {
          onClear();
          toast('Cleared', 'neutral');
        }}
        disabled={disabled}
      >
        Clear
      </ToolButton>

      <input
        ref={fileInputRef}
        type="file"
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
