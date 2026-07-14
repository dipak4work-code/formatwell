/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from './protocol';
import { formatJson, minifyJson, validateJson, type JsonFormatOptions } from '@/lib/parsers/json';
import type { ParseResult } from '@/lib/parsers/types';

export type JsonOp = 'validate' | 'format' | 'minify';

export interface JsonJob {
  op: JsonOp;
  input: string;
  options?: JsonFormatOptions;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function run(job: JsonJob): ParseResult {
  switch (job.op) {
    case 'validate':
      return validateJson(job.input);
    case 'format':
      return formatJson(job.input, job.options);
    case 'minify':
      return minifyJson(job.input);
  }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest<JsonJob>>) => {
  const { id, payload } = event.data;
  try {
    const response: WorkerResponse<ParseResult> = { id, result: run(payload) };
    ctx.postMessage(response);
  } catch (e) {
    const response: WorkerResponse<ParseResult> = {
      id,
      error: e instanceof Error ? e.message : 'JSON worker failed',
    };
    ctx.postMessage(response);
  }
};
