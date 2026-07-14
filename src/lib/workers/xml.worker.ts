/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from './protocol';
import { formatXml, minifyXml, validateXml, type XmlIndent } from '@/lib/parsers/xml';
import type { ParseResult } from '@/lib/parsers/types';

export type XmlOp = 'validate' | 'format' | 'minify';

export interface XmlJob {
  op: XmlOp;
  input: string;
  indent?: XmlIndent;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function run(job: XmlJob): ParseResult {
  switch (job.op) {
    case 'validate':
      return validateXml(job.input);
    case 'format':
      return formatXml(job.input, job.indent);
    case 'minify':
      return minifyXml(job.input);
  }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest<XmlJob>>) => {
  const { id, payload } = event.data;
  try {
    const response: WorkerResponse<ParseResult> = { id, result: run(payload) };
    ctx.postMessage(response);
  } catch (e) {
    const response: WorkerResponse<ParseResult> = {
      id,
      error: e instanceof Error ? e.message : 'XML worker failed',
    };
    ctx.postMessage(response);
  }
};
