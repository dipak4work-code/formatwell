import type { Metadata } from 'next';
import { XmlTool } from '@/components/xml/XmlTool';
import { ToolHelp } from '@/components/ToolHelp';
import { ToolHeader } from '@/components/ToolHeader';
import { TOOLS } from '@/lib/site';

const tool = TOOLS.find((t) => t.id === 'xml')!;

export const metadata: Metadata = {
  title: 'XML Validator & Formatter — free, private, in-browser',
  description: tool.description,
  alternates: { canonical: '/xml' },
};

export default function XmlPage() {
  return (
    <div className="flex flex-col">
      <ToolHeader
        title="XML well-formedness validator & formatter"
        description={tool.description}
      />

      <XmlTool />

      <ToolHelp
        heading="About this XML tool"
        intro={[
          'Paste or upload XML to check that it is well-formed, pretty-print it, and browse its structure. This is a well-formedness validator: it verifies that tags are properly nested and closed, attributes are quoted, and characters are legal. Validation runs as you type and reports the exact line and column of the first problem in plain language — click an error to jump straight to it.',
          'Format pretty-prints with 2 spaces, 4 spaces, or tabs while preserving the XML declaration, namespaces, comments, and CDATA sections unchanged in meaning; Minify collapses whitespace. The Tree tab shows a collapsible view of elements and attributes. Everything runs in your browser — nothing you paste is uploaded — and large documents are parsed in a background worker so the interface stays responsive.',
          'Common problems it catches include unclosed tags, mismatched opening and closing tags, unquoted attribute values, and illegal characters such as a bare ampersand.',
        ]}
        faqs={[
          {
            q: 'Does this validate against a schema (XSD or DTD)?',
            a: 'Not yet. This tool checks well-formedness only — structure, nesting, quoting, and legal characters. Validation against an XSD or DTD schema is on the roadmap and is not performed in this version.',
          },
          {
            q: 'Are comments and CDATA preserved when I format?',
            a: 'Yes. Formatting and minifying preserve the XML declaration, namespaces, comments, and CDATA sections. Only whitespace between elements changes.',
          },
          {
            q: 'Is my XML sent to a server?',
            a: 'No. All validation and formatting happen entirely in your browser. Your data never leaves your device.',
          },
        ]}
      />
    </div>
  );
}
