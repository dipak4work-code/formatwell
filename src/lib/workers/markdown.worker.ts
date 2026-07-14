/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from './protocol';
import { lintMarkdown } from '@/lib/parsers/markdown';
import type { ParseResult } from '@/lib/parsers/types';

export interface MarkdownJob {
  input: string;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<WorkerRequest<MarkdownJob>>) => {
  const { id, payload } = event.data;
  try {
    const result: ParseResult = await lintMarkdown(payload.input);
    const response: WorkerResponse<ParseResult> = { id, result };
    ctx.postMessage(response);
  } catch (e) {
    const response: WorkerResponse<ParseResult> = {
      id,
      error: e instanceof Error ? e.message : 'Markdown worker failed',
    };
    ctx.postMessage(response);
  }
};
