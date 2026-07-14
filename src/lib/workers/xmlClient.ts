import { WorkerClient } from './client';
import type { XmlJob } from './xml.worker';
import { formatXml, minifyXml, validateXml } from '@/lib/parsers/xml';
import type { ParseResult } from '@/lib/parsers/types';
import { WORKER_THRESHOLD_BYTES } from './jsonClient';

function runOnMain(job: XmlJob): ParseResult {
  switch (job.op) {
    case 'validate':
      return validateXml(job.input);
    case 'format':
      return formatXml(job.input, job.indent);
    case 'minify':
      return minifyXml(job.input);
  }
}

/** Dispatches XML work to a Web Worker for large inputs; small inputs run inline. */
export class XmlProcessor {
  private client: WorkerClient<XmlJob, ParseResult> | null = null;

  private ensureClient(): WorkerClient<XmlJob, ParseResult> {
    if (!this.client) {
      this.client = new WorkerClient<XmlJob, ParseResult>(
        () => new Worker(new URL('./xml.worker.ts', import.meta.url)),
      );
    }
    return this.client;
  }

  usesWorker(input: string): boolean {
    return input.length > WORKER_THRESHOLD_BYTES;
  }

  async process(job: XmlJob): Promise<ParseResult> {
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
