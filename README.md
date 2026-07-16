# FormatWell — validateformat.com

**Live at [validateformat.com](https://validateformat.com)** — fast, privacy-first developer
tools that run 100% in your browser. No backend, no upload, no tracking of your content.

> Everything runs in your browser. Your data never leaves your device.

## Tools

| Tool | What it does |
| --- | --- |
| **[JSON](https://validateformat.com/json)** | Validate (exact error line/column), format, minify, collapsible tree view |
| **[JSONL](https://validateformat.com/jsonl)** | Per-line NDJSON validation, minify, convert JSONL ⇄ JSON array |
| **[XML](https://validateformat.com/xml)** | Well-formedness validation, format/minify, element tree |
| **[Markdown](https://validateformat.com/markdown)** | Live sanitized preview (GFM), lint, export .md / styled HTML / PDF |
| **[Agent Trace](https://validateformat.com/agent-trace)** | Visualize Claude Code & Codex session transcripts: interactive graph, step-by-step replay, live watch, PNG/PDF export |

Plus **[guides](https://validateformat.com/guides)** explaining every common `JSON.parse` error
with causes and fixes.

## Agent Trace highlights

- **Auto-detects** Claude Code sessions (`~/.claude/projects/**/*.jsonl`), Codex rollouts
  (`~/.codex/sessions/**/rollout-*.jsonl`), and generic role/content chat JSONL
- **Interactive graph** — turns on a spine, tool calls fanning out, subagent branches,
  failures in red; pan/zoom, click any node for full input/result
- **Play mode** — replay the session step by step with scrubber and speed control
- **Live watch** — point it at a running session's file and watch the graph grow (Chromium)
- **Exports** — PNG of the graph, or a step-by-step PDF report — all generated locally

## Privacy model

All parsing, rendering, and exporting happens client-side (Web Workers for large inputs).
Fonts are self-hosted; a strict CSP is shipped; analytics is Cloudflare Web Analytics
(cookieless) and never sees editor content. Transcripts, payloads, and documents are
never transmitted anywhere.

## Tech

Next.js 14 (App Router, static export) · TypeScript strict · Tailwind CSS · CodeMirror 6 ·
fast-xml-parser · markdown-it + DOMPurify · remark-lint · custom dependency-free PDF writer ·
Vitest (100+ tests)

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run test       # vitest
npm run build      # static export → out/
npm run deploy     # build + wrangler pages deploy (Cloudflare Pages)
```

Every parser returns a shared `ParseResult` contract (`src/lib/parsers/types.ts`), so the
editor diagnostics, error panel, and status spine are built once and reused by every tool.

## Deploying your own

`npm run build` emits a fully static site in `out/` — host it anywhere (Cloudflare Pages,
Netlify, Vercel, GitHub Pages, S3). A GitHub Actions workflow (`.github/workflows/deploy.yml`)
deploys to Cloudflare Pages on push to `main` (requires `CLOUDFLARE_API_TOKEN` +
`CLOUDFLARE_ACCOUNT_ID` secrets).

## License

[MIT](LICENSE)
