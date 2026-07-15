import type { Metadata } from 'next';
import { TraceTool } from '@/components/trace/TraceTool';
import { ToolHelp } from '@/components/ToolHelp';
import { ToolHeader } from '@/components/ToolHeader';
import { TOOLS } from '@/lib/site';

const tool = TOOLS.find((t) => t.id === 'agent-trace')!;

export const metadata: Metadata = {
  title: 'Claude Code Session Trace Viewer — free, private, in-browser',
  description: tool.description,
  alternates: { canonical: '/agent-trace' },
};

export default function AgentTracePage() {
  return (
    <div className="flex flex-col">
      <ToolHeader title="Claude Code session trace viewer" description={tool.description} />

      <TraceTool />

      <ToolHelp
        heading="About this trace viewer"
        intro={[
          'Claude Code records every session as a JSONL transcript in ~/.claude/projects/<project>/<session-id>.jsonl. Each line is one event: your prompts, the assistant’s responses, every tool call with its input and result, subagent branches, and token usage. Reading those files by hand is painful — this viewer turns them into a readable timeline.',
          'Upload or paste a transcript and you get session stats (turns, tool calls, tool errors, output tokens, cache reads, duration) and a turn-by-turn timeline. Expand any tool call to inspect exactly what was run and what came back — failed calls are flagged in red. Subagent (sidechain) activity is indented and badged, and synthetic meta records can be toggled on when you need the full picture.',
          'Like every tool on this site, parsing happens entirely in your browser via a Web Worker — your transcripts, which often contain proprietary code and file paths, are never uploaded anywhere.',
        ]}
        faqs={[
          {
            q: 'Where do I find my Claude Code session transcripts?',
            a: 'In ~/.claude/projects/ — each project directory contains one .jsonl file per session, named by the session UUID. On Windows that is C:\\Users\\<you>\\.claude\\projects\\. Upload the .jsonl file here to view it.',
          },
          {
            q: 'Is it safe to open transcripts that contain my company’s code?',
            a: 'Yes. The transcript is parsed locally in your browser and never transmitted. There is no server, no logging, and no analytics that captures content. Closing the tab discards everything.',
          },
          {
            q: 'What does the viewer show?',
            a: 'A timeline of user and assistant turns; every tool call with its input and result (expandable, errors highlighted); subagent branches; thinking sizes; per-session stats including tool-call counts, token usage, cache reads, models used, and duration.',
          },
          {
            q: 'Does it work with other agent logs?',
            a: 'It is built for Claude Code session transcripts. Other JSONL event logs will parse as JSONL (try the JSONL tool for those), but the timeline expects Claude Code’s record structure — user, assistant, and system records with tool_use and tool_result blocks.',
          },
          {
            q: 'How large a transcript can it handle?',
            a: 'Transcripts up to about 10 MB are supported — that is a multi-day session. Parsing runs in a background Web Worker and typically takes well under a second even for multi-megabyte files.',
          },
        ]}
      />
    </div>
  );
}
