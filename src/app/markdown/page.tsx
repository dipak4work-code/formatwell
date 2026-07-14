import type { Metadata } from 'next';
import { MarkdownTool } from '@/components/markdown/MarkdownTool';
import { ToolHelp } from '@/components/ToolHelp';
import { TOOLS } from '@/lib/site';

const tool = TOOLS.find((t) => t.id === 'markdown')!;

export const metadata: Metadata = {
  title: 'Markdown Editor & Preview — free, private, in-browser',
  description: tool.description,
  alternates: { canonical: '/markdown' },
};

export default function MarkdownPage() {
  return (
    <div className="flex flex-col">
      <header className="mb-5 flex flex-col gap-1">
        <p className="font-mono text-label uppercase tracking-wide text-muted">Tool</p>
        <h1 className="font-mono text-title font-600 text-ink">
          Markdown editor, preview &amp; linter
        </h1>
        <p className="max-w-2xl text-body text-muted">{tool.description}</p>
      </header>

      <MarkdownTool />

      <ToolHelp
        heading="About this Markdown tool"
        intro={[
          'Write GitHub-flavored Markdown on the left and see a live, rendered preview on the right as you type. Tables, task lists, strikethrough, autolinked URLs, and fenced code blocks with syntax highlighting are all supported. The preview scroll position tracks the editor so you keep your place in long documents.',
          'Every preview is sanitized with DOMPurify before it is shown, so embedded scripts and event handlers are rendered inert — safe to paste untrusted Markdown. The lint panel uses the remark-lint recommended rules and flags issues such as bare URLs, heading levels that skip a rank, and links that reference an undefined definition, each as an advisory warning you can click to jump to.',
          'Use the toolbar to load a sample, copy the rendered HTML (already sanitized), or download your document as a .md file. Everything runs in your browser — nothing you write is ever uploaded.',
        ]}
        faqs={[
          {
            q: 'Is the preview safe if I paste untrusted Markdown?',
            a: 'Yes. All rendered HTML passes through DOMPurify, which removes scripts, event handlers, and dangerous URLs. Injected code renders as inert text rather than executing.',
          },
          {
            q: 'Which Markdown flavor is supported?',
            a: 'GitHub-flavored Markdown (GFM): tables, task lists, strikethrough, and autolinks, plus fenced code blocks with syntax highlighting.',
          },
          {
            q: 'Does “Copy as HTML” include styles?',
            a: 'It copies the sanitized semantic HTML (headings, lists, tables, code). Apply your own CSS where you paste it. Your content is never sent to a server.',
          },
        ]}
      />
    </div>
  );
}
