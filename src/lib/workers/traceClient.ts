import { WorkerClient } from './client';
import type { TraceJob } from './trace.worker';
import type { TraceParseOutput } from '@/lib/parsers/agentTrace';
import { WORKER_THRESHOLD_BYTES } from './jsonClient';

/** Dispatches trace parsing to a Web Worker for large transcripts. */
export class TraceProcessor {
  private client: WorkerClient<TraceJob, TraceParseOutput> | null = null;

  private ensureClient(): WorkerClient<TraceJob, TraceParseOutput> {
    if (!this.client) {
      this.client = new WorkerClient<TraceJob, TraceParseOutput>(
        () => new Worker(new URL('./trace.worker.ts', import.meta.url)),
      );
    }
    return this.client;
  }

  usesWorker(input: string): boolean {
    return input.length > WORKER_THRESHOLD_BYTES;
  }

  async process(input: string): Promise<TraceParseOutput> {
    if (this.usesWorker(input)) {
      return this.ensureClient().run({ input });
    }
    const { parseTrace } = await import('@/lib/parsers/traceDispatch');
    return parseTrace(input);
  }

  dispose(): void {
    this.client?.terminate();
    this.client = null;
  }
}
