import type { WorkerRequest, WorkerResponse } from './protocol';

/**
 * Thin promise wrapper over a dedicated Worker using the shared request/response
 * envelope. One in-flight map keyed by request id lets multiple calls overlap.
 */
export class WorkerClient<TReq = unknown, TRes = unknown> {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (r: TRes) => void; reject: (e: Error) => void }
  >();

  /**
   * @param factory Returns a fresh Worker. Must be a call site with a static
   *   `new Worker(new URL('./x.worker.ts', import.meta.url))` so the bundler can
   *   emit the worker chunk.
   */
  constructor(private factory: () => Worker) {}

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const worker = this.factory();
    worker.onmessage = (event: MessageEvent<WorkerResponse<TRes>>) => {
      const { id, result, error } = event.data;
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      if (error) entry.reject(new Error(error));
      else entry.resolve(result as TRes);
    };
    worker.onerror = (event) => {
      // Fail all in-flight requests; the next call re-creates the worker.
      const err = new Error(event.message || 'Worker error');
      for (const { reject } of this.pending.values()) reject(err);
      this.pending.clear();
      this.terminate();
    };
    this.worker = worker;
    return worker;
  }

  run(payload: TReq): Promise<TRes> {
    const worker = this.ensure();
    const id = this.nextId++;
    const request: WorkerRequest<TReq> = { id, payload };
    return new Promise<TRes>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(request);
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

/** Echo worker factory (Phase 2 plumbing check). */
export function createEchoClient<T = unknown>(): WorkerClient<T, T> {
  return new WorkerClient<T, T>(
    () => new Worker(new URL('./echo.worker.ts', import.meta.url)),
  );
}
