import { WorkerClient } from './client';
import type { MarkdownJob } from './markdown.worker';
import type { ParseResult } from '@/lib/parsers/types';
import { WORKER_THRESHOLD_BYTES } from './jsonClient';

/** Dispatches Markdown linting to a Web Worker for large inputs; small inputs run inline. */
export class MarkdownProcessor {
  private client: WorkerClient<MarkdownJob, ParseResult> | null = null;

  private ensureClient(): WorkerClient<MarkdownJob, ParseResult> {
    if (!this.client) {
      this.client = new WorkerClient<MarkdownJob, ParseResult>(
        () => new Worker(new URL('./markdown.worker.ts', import.meta.url)),
      );
    }
    return this.client;
  }

  usesWorker(input: string): boolean {
    return input.length > WORKER_THRESHOLD_BYTES;
  }

  async lint(input: string): Promise<ParseResult> {
    if (this.usesWorker(input)) {
      return this.ensureClient().run({ input });
    }
    // Lazy-load the remark stack so it stays out of the initial /markdown bundle.
    const { lintMarkdown } = await import('@/lib/parsers/markdown');
    return lintMarkdown(input);
  }

  dispose(): void {
    this.client?.terminate();
    this.client = null;
  }
}
