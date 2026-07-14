'use client';

import { useRef } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { ToolButton } from '@/components/ui/ToolButton';
import { copyToClipboard, downloadText, readClipboard, readTextFile } from '@/lib/utils/io';

interface JsonlToolbarProps {
  onInsertText: (text: string) => void;
  onValidate: () => void;
  onMinify: () => void;
  onToArray: () => void;
  onFromArray: () => void;
  onClear: () => void;
  output?: string;
  sample?: string;
  downloadName?: string;
  downloadMime?: string;
}

export function JsonlToolbar({
  onInsertText,
  onValidate,
  onMinify,
  onToArray,
  onFromArray,
  onClear,
  output,
  sample,
  downloadName = 'data.jsonl',
  downloadMime = 'application/x-ndjson',
}: JsonlToolbarProps) {
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
      <ToolButton onClick={onValidate} primary>
        Validate
      </ToolButton>
      <ToolButton onClick={onMinify}>Minify</ToolButton>
      <ToolButton onClick={onToArray} title="Convert JSONL to a JSON array">
        To JSON array
      </ToolButton>
      <ToolButton onClick={onFromArray} title="Convert a JSON array in the editor to JSONL">
        From JSON array
      </ToolButton>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

      <ToolButton onClick={handlePaste}>Paste</ToolButton>
      <ToolButton onClick={() => fileInputRef.current?.click()}>Upload</ToolButton>
      {sample !== undefined && (
        <ToolButton
          onClick={() => {
            onInsertText(sample);
            toast('Sample loaded', 'neutral');
          }}
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
        disabled={!hasOutput}
      >
        Copy output
      </ToolButton>
      <ToolButton
        onClick={() => {
          downloadText(downloadName, output ?? '', downloadMime);
          toast('Downloaded', 'neutral');
        }}
        disabled={!hasOutput}
      >
        Download
      </ToolButton>
      <ToolButton
        onClick={() => {
          onClear();
          toast('Cleared', 'neutral');
        }}
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
