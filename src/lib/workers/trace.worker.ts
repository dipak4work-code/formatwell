/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from './protocol';
import { parseAgentTrace, type TraceParseOutput } from '@/lib/parsers/agentTrace';

export interface TraceJob {
  input: string;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest<TraceJob>>) => {
  const { id, payload } = event.data;
  try {
    const response: WorkerResponse<TraceParseOutput> = {
      id,
      result: parseAgentTrace(payload.input),
    };
    ctx.postMessage(response);
  } catch (e) {
    const response: WorkerResponse<TraceParseOutput> = {
      id,
      error: e instanceof Error ? e.message : 'Trace worker failed',
    };
    ctx.postMessage(response);
  }
};
