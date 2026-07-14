import type { Metadata } from 'next';
import { JsonTool } from '@/components/json/JsonTool';
import { ToolHelp } from '@/components/ToolHelp';
import { ToolHeader } from '@/components/ToolHeader';
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
      <ToolHeader title="JSON viewer, formatter & validator" description={tool.description} />

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
            q: 'Is it safe to validate sensitive or confidential JSON?',
            a: 'Yes. Because everything runs locally in your browser and nothing is transmitted, it is safe for confidential payloads such as API keys, access tokens, configuration files, and personal data. No request carrying your content is ever made, and closing the tab discards it entirely.',
          },
          {
            q: 'Can validating untrusted JSON be a security risk?',
            a: 'No. Validation uses the browser’s native JSON.parse, which only reads data — it never executes code, unlike eval(). A malicious string in JSON cannot run scripts or commands here; at worst it is reported as invalid. Rendered output is plain text, so there is no cross-site scripting risk from JSON content.',
          },
          {
            q: 'Why does my JSON with trailing commas fail?',
            a: 'The JSON standard (RFC 8259) does not allow a comma after the last element in an object or array. Remove the trailing comma — the validator points you to its exact line and column.',
          },
          {
            q: 'Does it support comments or trailing commas (JSON5 / JSONC)?',
            a: 'No. This validator follows strict RFC 8259 JSON, which does not permit comments or trailing commas. Formats like JSON5 and JSONC (used in some config files) allow them, but they are not valid standard JSON — remove comments and trailing commas to pass validation.',
          },
          {
            q: 'How do I fix "Unexpected token" or "Expected property name" errors?',
            a: 'These mean the parser found a character it did not expect at that point — often a missing comma or colon, an unquoted key, single quotes instead of double quotes, or a trailing comma. The error tells you the exact line and column; click it to jump to that spot in the editor.',
          },
          {
            q: 'What is the maximum JSON size I can validate?',
            a: 'Files up to about 10 MB are supported. Inputs above ~100 KB are parsed in a background Web Worker so the interface stays responsive, and a "validating" indicator shows while it runs.',
          },
        ]}
      />
    </div>
  );
}
