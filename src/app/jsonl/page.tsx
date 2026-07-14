import type { Metadata } from 'next';
import { JsonlTool } from '@/components/jsonl/JsonlTool';
import { ToolHelp } from '@/components/ToolHelp';
import { ToolHeader } from '@/components/ToolHeader';
import { TOOLS } from '@/lib/site';

const tool = TOOLS.find((t) => t.id === 'jsonl')!;

export const metadata: Metadata = {
  title: 'JSONL / NDJSON Validator & Converter — free, private, in-browser',
  description: tool.description,
  alternates: { canonical: '/jsonl' },
};

export default function JsonlPage() {
  return (
    <div className="flex flex-col">
      <ToolHeader
        title="JSONL / NDJSON viewer, validator & converter"
        description={tool.description}
      />

      <JsonlTool />

      <ToolHelp
        heading="About this JSONL tool"
        intro={[
          'JSONL (JSON Lines, also called NDJSON — newline-delimited JSON) stores one JSON value per line, with no wrapping array and no commas between records. It is the common format for logs, streaming APIs, and data exports. Paste or upload JSONL to validate every line, and the tool reports the exact file line and column of the first problem in plain language — click an error to jump straight to it.',
          'Minify canonicalizes each record onto its own line. You can also convert JSONL to a pretty-printed JSON array (choose 2 spaces, 4 spaces, or tabs), or convert a JSON array back into JSONL. The Tree tab shows every record as a collapsible node. Everything runs in your browser — nothing you paste is uploaded — and large files are parsed in a background worker so the interface stays responsive.',
          'Common problems it catches include blank lines between records, trailing commas inside a record, and a JSON array or object accidentally split across multiple lines.',
        ]}
        faqs={[
          {
            q: 'What is the difference between JSON and JSONL?',
            a: 'A JSON document is one value (often an array of objects) that may span many lines. JSONL puts one complete JSON value on each line, with no enclosing array and no commas between lines — ideal for streaming and appending records.',
          },
          {
            q: 'Is JSONL the same as NDJSON?',
            a: 'Yes. JSONL (JSON Lines) and NDJSON (Newline-Delimited JSON) refer to the same format: one JSON value per line. Files use the .jsonl or .ndjson extension. This tool validates both, since they are identical in practice.',
          },
          {
            q: 'Is my JSONL data private and secure?',
            a: 'Yes. Every line is validated locally in your browser — nothing is uploaded, logged, or stored on a server. That makes it safe for sensitive log exports, event streams, and data dumps containing personal or confidential information. Validation uses the native JSON.parse, which reads data only and never executes code.',
          },
          {
            q: 'Are blank lines allowed in JSONL?',
            a: 'No. Each line must be exactly one JSON value. This validator flags blank lines between records as errors, while allowing a single trailing newline at the end of the file.',
          },
          {
            q: 'How do I find which line of a large JSONL file is invalid?',
            a: 'The validator checks every line and reports the exact file line and column of each problem in plain language. Click any error in the panel to jump straight to that line in the editor, where the offending row is highlighted — handy for multi-thousand-line log files.',
          },
          {
            q: 'Can I convert between JSONL and a JSON array?',
            a: 'Yes. Use “To JSON array” to wrap all records into a pretty-printed array, and “From JSON array” to turn a JSON array in the editor into JSONL (one record per line). Both run entirely in your browser.',
          },
          {
            q: 'What is the maximum JSONL file size I can validate?',
            a: 'Files up to about 10 MB are supported. Larger inputs (above ~100 KB) are parsed in a background Web Worker so the interface never freezes, even with tens of thousands of records.',
          },
        ]}
      />
    </div>
  );
}
