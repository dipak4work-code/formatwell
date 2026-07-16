import type { Metadata } from 'next';
import { TraceTool } from '@/components/trace/TraceTool';
import { ToolHelp } from '@/components/ToolHelp';
import { ToolHeader } from '@/components/ToolHeader';
import { TOOLS } from '@/lib/site';

const tool = TOOLS.find((t) => t.id === 'agent-trace')!;

export const metadata: Metadata = {
  title: 'AI Agent Session Trace Viewer (Claude Code, Codex) — free, private, in-browser',
  description: tool.description,
  alternates: { canonical: '/agent-trace' },
};

export default function AgentTracePage() {
  return (
    <div className="flex flex-col">
      <ToolHeader title="AI agent session trace viewer" description={tool.description} />

      <TraceTool />

      <ToolHelp
        heading="About this trace viewer"
        intro={[
          'Coding agents record their sessions as JSONL transcripts — Claude Code in ~/.claude/projects/<project>/<session-id>.jsonl, Codex CLI in ~/.codex/sessions/<date>/rollout-*.jsonl. Each line is one event: your prompts, the assistant’s responses, every tool call with its input and result, subagent branches, and token usage. Reading those files by hand is painful — this viewer auto-detects the format and turns them into a readable picture.',
          'Upload or paste a transcript and you get session stats (turns, tool calls, tool errors, output tokens, cache reads, duration) plus two views: an interactive graph — pan, zoom, and click any node to inspect a turn or tool call, with failed calls flagged in red and subagent branches drawn as offset chains — and a turn-by-turn timeline. Press Play to replay the session step by step and watch the graph build itself node by node, with a scrubber, speed control, and single-step buttons that narrate each event in the detail panel. Synthetic meta records can be toggled on when you need the full picture.',
          'There is also a live mode: in Chrome or Edge, press "Watch live" and pick the transcript of a running session — the graph re-reads the file as Claude works and grows in real time, with an optional follow-the-tail view. Like every tool on this site, parsing happens entirely in your browser via a Web Worker — your transcripts, which often contain proprietary code and file paths, are never uploaded anywhere, in live mode or otherwise.',
        ]}
        faqs={[
          {
            q: 'Where do I find my agent session transcripts?',
            a: 'Claude Code: ~/.claude/projects/ — each project directory contains one .jsonl file per session, named by the session UUID (on Windows, C:\\Users\\<you>\\.claude\\projects\\). Codex CLI: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl. Upload the .jsonl file here to view it.',
          },
          {
            q: 'Which agent formats are supported?',
            a: 'Claude Code session transcripts and OpenAI Codex CLI rollout files are detected and parsed natively, including tool calls with linked results, reasoning, subagents (Claude), and token usage. Transcripts from other agents that use chat-style JSONL — lines with role and content, optionally with OpenAI-style tool_calls — are parsed by a generic adapter on a best-effort basis.',
          },
          {
            q: 'Is it safe to open transcripts that contain my company’s code?',
            a: 'Yes. The transcript is parsed locally in your browser and never transmitted. There is no server, no logging, and no analytics that captures content. Closing the tab discards everything.',
          },
          {
            q: 'What does the viewer show?',
            a: 'An interactive graph (pan/zoom canvas of turns, tool calls, and subagent branches — click any node for its full input and result), a step-by-step replay with play/pause, scrubbing, and speed control, and a timeline view; plus per-session stats including tool-call counts, tool errors, token usage, cache reads, models used, and duration. You can export the graph as a PNG image or download the entire session as a step-by-step PDF report — both generated locally in your browser.',
          },
          {
            q: 'Can I watch a session live while Claude Code is running?',
            a: 'Yes, in Chrome or Edge. Press "Watch live" and select the session\'s .jsonl file — the viewer re-reads it every couple of seconds and the graph grows in real time as the agent works. The file is read locally via the File System Access API; nothing is uploaded. Firefox and Safari do not support this API yet, so use Upload there.',
          },
          {
            q: 'Can I watch Codex sessions live too?',
            a: 'Yes — live watch works with any supported format. Pick the rollout file of a running Codex session (or any growing transcript) and the graph updates as the file is appended to. Non-transcript JSONL event logs are better suited to the JSONL tool.',
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
