/** Client-side file / clipboard helpers. All operations stay on-device (spec §2). */

export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB hard limit
export const WARN_BYTES = 2 * 1024 * 1024; // warn above 2 MB

export interface FileReadResult {
  ok: boolean;
  text?: string;
  /** Present when ok === false. */
  error?: string;
  /** Present when ok === true and the file is large enough to warn about. */
  warning?: string;
  bytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readTextFile(file: File): Promise<FileReadResult> {
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      bytes: file.size,
      error: `File is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_BYTES)}.`,
    };
  }
  const text = await file.text();
  const warning =
    file.size > WARN_BYTES
      ? `Large file (${formatBytes(file.size)}) — parsing may take a moment.`
      : undefined;
  return { ok: true, text, warning, bytes: file.size };
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }));
}

export async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

export { byteLength } from './bytes';
