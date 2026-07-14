/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from './protocol';

/**
 * Phase 2 no-op echo worker: proves the main-thread ↔ worker plumbing end to end.
 * Later phases replace this with real json/xml/markdown parser workers using the
 * same envelope.
 */
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest<unknown>>) => {
  const { id, payload } = event.data;
  const response: WorkerResponse<unknown> = { id, result: payload };
  ctx.postMessage(response);
};
