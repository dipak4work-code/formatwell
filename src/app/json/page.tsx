import type { Metadata } from 'next';
import { JsonTool } from '@/components/json/JsonTool';
import { ToolHelp } from '@/components/ToolHelp';
import { TOOLS } from '@/lib/site';

const tool = TOOLS.find((t) => t.id === 'json')!;

export const metadata: Metadata = {
  title: 'JSON Validator & Formatter — free, private, in-browser',
  description: tool.description,
  alternates: { canonical: '/json' },
};

export default function JsonPage() {
  return (
    <div className="flex flex-col">
      <header className="mb-5 flex flex-col gap-1">
        <p className="font-mono text-label uppercase tracking-wide text-muted">Tool</p>
        <h1 className="font-mono text-title font-600 text-ink">
          JSON viewer, formatter &amp; validator
        </h1>
        <p className="max-w-2xl text-body text-muted">{tool.description}</p>
      </header>

      <JsonTool />

      <ToolHelp
        heading="About this JSON tool"
        intro={[
          'Paste or upload JSON to validate, format, and explore it. Validation runs the moment you stop typing and reports the exact line and column of the first problem, in plain language — no cryptic engine messages. Click any error to jump straight to it in the editor.',
          'Format pretty-prints with your choice of 2 spaces, 4 spaces, or tabs; Minify strips whitespace for the smallest payload. The Tree tab renders the parsed document as collapsible nodes with type colors and item counts, so you can navigate large responses quickly. Everything runs in your browser — nothing you paste is ever uploaded — and large files are parsed in a background worker so the interface never freezes.',
          'Common problems it catches include trailing commas, single-quoted strings and keys, missing commas or colons, unquoted property names, and unclosed brackets or braces.',
        ]}
        faqs={[
          {
            q: 'Is my JSON uploaded to a server?',
            a: 'No. All parsing, formatting, and validation happen entirely in your browser using JavaScript. Your data never leaves your device, and there is no logging of content.',
          },
          {
            q: 'Why does my JSON with trailing commas fail?',
            a: 'The JSON standard (RFC 8259) does not allow a comma after the last element in an object or array. Remove the trailing comma — the validator points you to its exact line and column.',
          },
          {
            q: 'Can it handle large files?',
            a: 'Yes. Files up to about 10 MB are supported. Inputs above ~100 KB are parsed in a Web Worker so the UI stays responsive, and you will see a "validating" indicator while it runs.',
          },
        ]}
      />
    </div>
  );
}
