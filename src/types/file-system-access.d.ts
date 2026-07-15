/**
 * WICG File System Access API — `showOpenFilePicker` is Chromium-only and not yet in
 * TypeScript's lib.dom (FileSystemFileHandle itself is). Used by the Agent Trace live
 * watch mode; always feature-detect before calling.
 */
interface OpenFilePickerType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: OpenFilePickerType[];
}

interface Window {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
}
