/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from './protocol';
import {
  arrayToJsonl,
  jsonlToArray,
  minifyJsonl,
  validateJsonl,
  type JsonlIndent,
} from '@/lib/parsers/jsonl';
import type { ParseResult } from '@/lib/parsers/types';

export type JsonlOp = 'validate' | 'minify' | 'toArray' | 'fromArray';

export interface JsonlJob {
  op: JsonlOp;
  input: string;
  indent?: JsonlIndent;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function run(job: JsonlJob): ParseResult {
  switch (job.op) {
    case 'validate':
      return validateJsonl(job.input);
    case 'minify':
      return minifyJsonl(job.input);
    case 'toArray':
      return jsonlToArray(job.input, job.indent);
    case 'fromArray':
      return arrayToJsonl(job.input);
  }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest<JsonlJob>>) => {
  const { id, payload } = event.data;
  try {
    const response: WorkerResponse<ParseResult> = { id, result: run(payload) };
    ctx.postMessage(response);
  } catch (e) {
    const response: WorkerResponse<ParseResult> = {
      id,
      error: e instanceof Error ? e.message : 'JSONL worker failed',
    };
    ctx.postMessage(response);
  }
};
