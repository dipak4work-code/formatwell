import { WorkerClient } from './client';
import type { JsonlJob } from './jsonl.worker';
import { arrayToJsonl, jsonlToArray, minifyJsonl, validateJsonl } from '@/lib/parsers/jsonl';
import type { ParseResult } from '@/lib/parsers/types';
import { WORKER_THRESHOLD_BYTES } from './jsonClient';

function runOnMain(job: JsonlJob): ParseResult {
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

/** Dispatches JSONL work to a Web Worker for large inputs; small inputs run inline. */
export class JsonlProcessor {
  private client: WorkerClient<JsonlJob, ParseResult> | null = null;

  private ensureClient(): WorkerClient<JsonlJob, ParseResult> {
    if (!this.client) {
      this.client = new WorkerClient<JsonlJob, ParseResult>(
        () => new Worker(new URL('./jsonl.worker.ts', import.meta.url)),
      );
    }
    return this.client;
  }

  usesWorker(input: string): boolean {
    return input.length > WORKER_THRESHOLD_BYTES;
  }

  async process(job: JsonlJob): Promise<ParseResult> {
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
