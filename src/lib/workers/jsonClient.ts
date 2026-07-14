import { WorkerClient } from './client';
import type { JsonJob } from './json.worker';
import { formatJson, minifyJson, validateJson } from '@/lib/parsers/json';
import type { ParseResult } from '@/lib/parsers/types';

/** Above this input size, parse off the main thread so the UI never freezes (spec §9). */
export const WORKER_THRESHOLD_BYTES = 100 * 1024;

function runOnMain(job: JsonJob): ParseResult {
  switch (job.op) {
    case 'validate':
      return validateJson(job.input);
    case 'format':
      return formatJson(job.input, job.options);
    case 'minify':
      return minifyJson(job.input);
  }
}

/**
 * Dispatches JSON work to a Web Worker for large inputs and runs small inputs inline
 * (avoids worker round-trip latency). Lazily creates the worker on first large input.
 */
export class JsonProcessor {
  private client: WorkerClient<JsonJob, ParseResult> | null = null;

  private ensureClient(): WorkerClient<JsonJob, ParseResult> {
    if (!this.client) {
      this.client = new WorkerClient<JsonJob, ParseResult>(
        () => new Worker(new URL('./json.worker.ts', import.meta.url)),
      );
    }
    return this.client;
  }

  /** Returns true when a job of this size would run in the worker. */
  usesWorker(input: string): boolean {
    // Byte length ~ char count is close enough to pick the lane; exact bytes not needed.
    return input.length > WORKER_THRESHOLD_BYTES;
  }

  async process(job: JsonJob): Promise<ParseResult> {
    if (this.usesWorker(job.input)) {
      return this.ensureClient().run(job);
    }
    return runOnMain(job);
  }

  dispose(): void {
    this.client?.terminate();
    this.client = null;
  }
}
