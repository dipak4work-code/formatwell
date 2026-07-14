# FormatWell

A fast, privacy-first, fully client-side developer utility with three tools:

- **JSON** — viewer, formatter, validator (exact error line/column)
- **JSONL / NDJSON** — per-line validator, minify, and JSON-array converter
- **XML** — viewer, formatter, well-formedness validator
- **Markdown** — live editor, sanitized preview, linter

> **Everything runs in your browser. Your data never leaves your device.**

No backend, no API calls with your data, no tracking. The site builds to static
files and deploys to any static host.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router, `output: 'export'`) + TypeScript (strict)
- [Tailwind CSS](https://tailwindcss.com/) with the "Ink & Signal" design tokens
- [CodeMirror 6](https://codemirror.net/) editor
- JSON: native `JSON.parse` + a custom cross-browser error position mapper
- XML: [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) + [xml-formatter](https://github.com/chrisbottin/xml-formatter)
- Markdown: [markdown-it](https://github.com/markdown-it/markdown-it) + [highlight.js](https://highlightjs.org/), sanitized with [DOMPurify](https://github.com/cure53/DOMPurify), linted with [remark-lint](https://github.com/remarkjs/remark-lint)
- Web Workers for parsing large inputs (>100 KB) off the main thread
- [Vitest](https://vitest.dev/) for parser/render/lint unit tests

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build → static export in `out/` |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run test` | Run the Vitest suite |
| `npm run format` | Prettier |

## Project structure

```
src/
├── app/                 # routes: /, /json, /xml, /markdown, /about + sitemap, robots, OG, 404
├── components/          # layout, editor, panels, json, xml, markdown, ui
├── lib/
│   ├── parsers/         # json.ts, xml.ts, markdown.ts + shared ParseResult type
│   ├── markdown/        # render (markdown-it + DOMPurify), stats
│   ├── workers/         # one worker + client per parser
│   ├── samples/         # sample payloads
│   └── utils/           # clipboard, file I/O, byte helpers
└── styles/              # globals.css with design tokens + preview styles
```

Every parser returns the same `ParseResult` contract, so the UI (editor diagnostics,
error panel, status spine) is built once against it.

## Building for production

```bash
npm run build
```

This produces a fully static site in `out/` (HTML, JS, CSS, `sitemap.xml`,
`robots.txt`, OpenGraph image). Serve `out/` from any static host or preview it locally
with e.g. `npx serve out`.

## Deploying

The site is a static export — no server runtime required.

### Vercel

Import the repo at [vercel.com/new](https://vercel.com/new). Vercel auto-detects
Next.js; because `next.config.mjs` sets `output: 'export'`, the build output is served
statically. No configuration needed. (Alternatively, set the output directory to `out`.)

### Netlify

Import the repo, then set:

- **Build command:** `npm run build`
- **Publish directory:** `out`

### Cloudflare Pages

Create a project from the repo, then set:

- **Framework preset:** Next.js (Static HTML Export) — or "None"
- **Build command:** `npm run build`
- **Build output directory:** `out`

### Any static host / self-hosted

Upload the contents of `out/` to any static file server (S3 + CloudFront, GitHub Pages,
nginx, etc.). Routes are exported with trailing slashes (`/json/`), so directory-style
hosting works out of the box.

## Privacy

All parsing, formatting, validation, and rendering happen in the browser. Fonts are
self-hosted at build time (no request to Google). There is no analytics that captures
editor content and no network request carrying your data.

## License

MIT
