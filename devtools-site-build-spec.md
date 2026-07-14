# DevTools Site — Build Specification

> **How to use this file:** Drop it in the root of an empty repo as the project brief for Claude Code (or keep it as `CLAUDE.md`). It contains the full product spec, tech stack, design system, and phased build order. The **Design Brief** section (§8) also works standalone as a brief for Claude Design if you want to prototype the UI first and refine tokens before coding.

---

## 1. Project Overview

A fast, privacy-first, fully client-side developer utility website with three tools:

1. **JSON** — viewer, formatter, validator
2. **XML** — viewer, formatter, validator (well-formedness)
3. **Markdown** — live editor, preview, linter

**Target audience:** developers pasting payloads, API responses, config files, and docs. They want instant results, error line numbers, and zero friction.

**Core promise (must appear in UI + footer):** *"Everything runs in your browser. Your data never leaves your device."*

---

## 2. Non-Negotiable Constraints

- **100% client-side.** No backend, no API calls with user data, no server-side parsing. All parsing/validation happens in the browser.
- **Static export.** The site must build to static files deployable on Vercel / Netlify / Cloudflare Pages.
- **One SEO page per tool.** Each tool lives at its own route with unique title, meta description, and on-page help content.
- **Large-input safe.** Inputs up to ~10 MB must not freeze the UI (use Web Workers for parsing).
- **No user tracking of content.** Analytics (if added later) must never capture editor contents.

---

## 3. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 14+ (App Router), `output: 'export'`** | Static export, per-tool SEO pages |
| Language | **TypeScript** (strict mode) | |
| Styling | **Tailwind CSS** | Tokens defined from §8 design system, via CSS variables |
| Editor | **CodeMirror 6** | Syntax highlighting, inline error markers, gutter |
| JSON | Native `JSON.parse` + custom error position mapper | Pretty/minify via `JSON.stringify` |
| JSON tree | Custom collapsible tree component (preferred) or `@textea/json-viewer` | |
| XML | **fast-xml-parser** (`XMLValidator` + parser) | Well-formedness with line numbers |
| XML format | **xml-formatter** | |
| Markdown | **markdown-it** with GFM (tables, task lists) | |
| MD sanitize | **DOMPurify** — mandatory on all rendered HTML | XSS protection, no exceptions |
| MD lint | **remark** + **remark-lint** preset (recommended rules) | |
| Workers | Native Web Workers (one per parser) | Comlink optional |
| Testing | **Vitest** + React Testing Library | Focus: parser wrappers + error mapping |
| Lint/format | ESLint + Prettier | |

Do not add a state management library — React state + URL state is sufficient.

---

## 4. Routes

| Route | Page | Primary keyword intent |
|---|---|---|
| `/` | Landing: what the site is, cards linking to the 3 tools, privacy promise | brand |
| `/json` | JSON viewer / formatter / validator | "json validator", "json formatter" |
| `/xml` | XML viewer / formatter / validator | "xml validator", "xml formatter" |
| `/markdown` | Markdown editor / preview / linter | "markdown editor online" |
| `/about` | Short page: privacy model, tech, contact | |

Each tool page includes, **below the tool**, a short help section (150–300 words): what the tool does, common errors it catches, and 2–3 FAQ entries. This content is real page content, not filler — it is what ranks.

---

## 5. Project Structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout, theme provider, header/footer
│   ├── page.tsx              # Landing
│   ├── json/page.tsx
│   ├── xml/page.tsx
│   ├── markdown/page.tsx
│   └── about/page.tsx
├── components/
│   ├── layout/               # Header, Footer, ThemeToggle
│   ├── editor/               # CodeEditor (CodeMirror wrapper), EditorToolbar
│   ├── panels/               # SplitPane, OutputPanel, ErrorPanel, StatusSpine
│   ├── json/                 # JsonTree, JsonToolbar
│   ├── xml/                  # XmlTree, XmlToolbar
│   └── markdown/             # MarkdownPreview, LintPanel
├── lib/
│   ├── parsers/
│   │   ├── json.ts           # validateJson(input) → ParseResult
│   │   ├── xml.ts            # validateXml(input) → ParseResult
│   │   └── markdown.ts       # lintMarkdown(input) → LintResult
│   ├── workers/              # json.worker.ts, xml.worker.ts, markdown.worker.ts
│   └── utils/                # file download/upload, clipboard, byte-size guard
└── styles/                   # globals.css with design tokens
```

**Shared result contract** (every parser returns this — the UI is built once against it):

```ts
type ParseResult = {
  ok: boolean;
  formatted?: string;          // pretty-printed output when ok
  errors: Array<{
    line: number;              // 1-based
    column: number;            // 1-based
    message: string;           // human-readable, plain language
    severity: 'error' | 'warning';
  }>;
  stats?: { bytes: number; lines: number; parseMs: number };
};
```

---

## 6. Shared Components (build these first)

### 6.1 CodeEditor (CodeMirror 6 wrapper)
- Props: `value`, `onChange`, `language ('json'|'xml'|'markdown')`, `errors: ParseResult['errors']`, `readOnly`.
- Renders inline error underlines + gutter markers from `errors`.
- Exposes `scrollToLine(line)` so clicking an error jumps the cursor.
- Keyboard: `Ctrl/Cmd + Enter` triggers validate; `Ctrl/Cmd + Shift + F` triggers format.

### 6.2 SplitPane
- Two panes, draggable divider, min 25% each.
- Stacks vertically below 768px.

### 6.3 EditorToolbar
- Actions: Paste, Upload file, Sample data, Validate, Format, Minify (JSON/XML only), Copy output, Download output, Clear.
- Upload guard: reject files > 10 MB with a clear message; warn above 2 MB that parsing may take a moment.
- Every action gives feedback (toast or inline state change) named consistently with the button — "Copy" → "Copied".

### 6.4 StatusSpine (signature element — see §8.4)
- A 4px vertical bar spanning the full height of the tool area, between the header and the editor pane.
- States: `idle` (neutral), `valid` (signal green), `invalid` (alert red), `warnings` (amber), `working` (animated subtle pulse, respects reduced motion).
- Doubles as the a11y live region announcing "Valid JSON — 240 lines" / "2 errors found, first at line 14".

### 6.5 ErrorPanel
- List of errors: `Line 14, Col 7 — Expected ',' or '}' after property value.`
- Clicking an error calls `scrollToLine`. Empty state when valid: a single quiet confirmation line with parse stats, never a celebration graphic.

---

## 7. Tool Specifications

### 7.1 JSON (`/json`)
**Features**
- Validate with exact line/column. Native `JSON.parse` error messages differ per browser — implement a position mapper: on failure, extract the index from the error where available, otherwise binary-search/scan to locate the failure point, and convert index → line/column.
- Format (2-space, configurable 2/4/tab) and Minify.
- Tree view tab: collapsible nodes, type-colored values, item counts on collapsed nodes, expand/collapse all.
- "Sample data" button loads a realistic ~50-line API response example.

**Acceptance criteria**
- `{"a":1,}` → error at the trailing comma's line/column, not a generic message.
- 5 MB file: UI stays responsive; parsing runs in the worker; StatusSpine shows `working`.
- Format → Minify → Format round-trips without data change.

### 7.2 XML (`/xml`)
**Features**
- Well-formedness validation via `XMLValidator.validate()` — surface its `err.line` / `err.col` / message through `ParseResult`.
- Format via `xml-formatter` (preserve CDATA and comments).
- Tree view of elements/attributes (parse with fast-xml-parser, `ignoreAttributes: false`).
- Explicitly label the tool "well-formedness validator" in help text; note that XSD schema validation is on the roadmap (do **not** attempt XSD in v1).

**Acceptance criteria**
- Unclosed tag, mismatched tag, bad attribute quoting, illegal character — each produces a located, plain-language error.
- XML declaration, namespaces, CDATA, and comments survive format unchanged in meaning.

### 7.3 Markdown (`/markdown`)
**Features**
- Live split view: editor left, rendered preview right (debounced ~150 ms).
- markdown-it with GFM: tables, task lists, strikethrough, autolinks, fenced code with syntax highlighting.
- **Every render passes through DOMPurify.** Add a test that `<img src=x onerror=alert(1)>` renders inert.
- Lint tab via remark-lint recommended preset: results appear in ErrorPanel as `warning` severity.
- Toolbar extras: word count, reading time, "Copy as HTML" (sanitized), "Download .md".

**Acceptance criteria**
- Preview scroll position roughly tracks editor scroll.
- Lint flags: bare URLs, inconsistent heading increments, undefined link references.
- Script injection attempts render as inert text.

---

## 8. Design Brief (also usable in Claude Design)

**Design intent:** This is a precision instrument, not a content site. The subject's world is *parsing* — gutters, brackets, diagnostics, the binary honesty of valid/invalid. The design should feel like a well-made measuring tool: calm, exact, and quietly confident. It must not look like a generic AI-generated page — specifically avoid: cream background + serif display + terracotta accent; near-black + single acid-green accent; and newspaper-broadsheet hairline layouts.

### 8.1 Palette — "Ink & Signal" (define as CSS variables, light + dark)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#F7F8FA` | `#14161F` | App background (cool, slightly blue paper) |
| `--surface` | `#FFFFFF` | `#1C1F2B` | Panels, editor |
| `--ink` | `#1E2230` | `#E8EAF2` | Primary text |
| `--muted` | `#5C6478` | `#9AA1B5` | Secondary text, gutters |
| `--accent` | `#3D5AFE` | `#7C93FF` | Interactive elements, focus, links (indigo — the "blueprint" tone) |
| `--valid` | `#0F9D6E` | `#2FD59B` | Valid state |
| `--invalid` | `#D93A4A` | `#FF6B7A` | Error state |
| `--warn` | `#C77D00` | `#F2B441` | Lint warnings |

Semantic colors (`valid` / `invalid` / `warn`) are reserved exclusively for validation state — never decorative. That reservation is what makes the state legible at a glance.

### 8.2 Typography
- **Data/editor + headings for tool pages:** *JetBrains Mono* — the mono is the personality here; use it for headings, stats, and labels, not just code.
- **Body/help text:** *IBM Plex Sans* (pairs naturally with mono, reads well at small sizes).
- Type scale: 13px editor/UI labels, 15px body, 20px section, 28px page title. Tight, technical, no oversized hero type.
- Sentence case everywhere. No ALL-CAPS except tiny eyebrow labels (e.g., `TOOL`, `RESULT`).

### 8.3 Layout
```
┌──────────────────────────────────────────────┐
│ Header:  ◧ logo   JSON  XML  Markdown   ☾    │
├──┬───────────────────────────────────────────┤
│S │ Toolbar: [Validate] [Format] [Minify] ... │
│p ├─────────────────────┬─────────────────────┤
│i │                     │  Output / Tree /    │
│n │   CodeMirror        │  Preview (tabs)     │
│e │   editor            │                     │
│  ├─────────────────────┴─────────────────────┤
│  │ ErrorPanel / stats strip                  │
├──┴───────────────────────────────────────────┤
│ Help content · FAQ · privacy promise footer  │
└──────────────────────────────────────────────┘
```
- Max width 1440px; the tool, not marketing copy, dominates above the fold on tool pages.
- Landing page: one plain sentence of what the site is, three tool cards (each card shows a live 3-line syntax-highlighted snippet, not an icon), privacy promise. No testimonials, no fake stats, no gradient hero.

### 8.4 Signature element
The **StatusSpine** (§6.4): a single vertical bar that is the page's only expressive element. It sits in the tool's left edge and carries the validation verdict in color; on validate, it fills top-to-bottom over ~300 ms. All other motion is limited to focus rings and 150 ms fades. Respect `prefers-reduced-motion` (spine changes color instantly, no fill animation).

### 8.5 Voice
- Buttons say what they do: "Validate", "Format", "Copy output".
- Errors explain and locate, never apologize: `Line 14, Col 7 — Expected ',' between properties.`
- Empty editor placeholder: `Paste JSON here, or load a sample.`

---

## 9. Performance
- Each parser runs in its own Web Worker; main thread never parses inputs > 100 KB.
- Code-split per route; CodeMirror language packages loaded per tool.
- Debounce live validation at 300 ms (Markdown preview 150 ms).
- Lighthouse targets on tool pages: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.

## 10. Accessibility
- Full keyboard operability: toolbar reachable by Tab, visible focus (accent-colored ring), shortcuts documented in a `?` popover.
- StatusSpine state mirrored to an `aria-live="polite"` region.
- Color is never the only signal: error list + gutter markers accompany the red spine.
- Contrast ≥ 4.5:1 for all text in both themes.

## 11. SEO
- Per-page `<title>` / meta description (e.g., `JSON Validator & Formatter — free, private, in-browser`).
- `sitemap.xml` + `robots.txt` generated at build.
- FAQ entries marked up with `FAQPage` JSON-LD.
- OpenGraph image per tool (static, generated once, matching §8 palette).

---

## 12. Build Phases (execute in order; each phase ends with `npm run build` passing and its checks green)

**Phase 1 — Scaffold**
Next.js + TypeScript strict + Tailwind + static export config; design tokens from §8.1/8.2 as CSS variables with light/dark via `class` strategy; Header, Footer, ThemeToggle; empty routes render.
✔ Check: static export succeeds, theme toggle persists (localStorage), no layout shift on load.

**Phase 2 — Shared core**
CodeEditor, SplitPane, EditorToolbar, StatusSpine, ErrorPanel; `ParseResult` type; worker plumbing with a no-op echo worker.
✔ Check: typing in editor, dragging divider, toolbar toasts, spine state cycling via a dev-only control.

**Phase 3 — JSON tool**
Parser wrapper + error position mapper (unit-tested against 10 malformed fixtures), format/minify, tree view, worker integration, sample data, help/FAQ content.
✔ Check: §7.1 acceptance criteria + Vitest suite green.

**Phase 4 — XML tool**
Validator + formatter wrappers (fixture-tested), tree view, help/FAQ content.
✔ Check: §7.2 acceptance criteria.

**Phase 5 — Markdown tool**
Editor/preview split, markdown-it + DOMPurify pipeline (XSS fixture test), remark-lint integration, word count / copy-as-HTML, help/FAQ content.
✔ Check: §7.3 acceptance criteria, XSS test green.

**Phase 6 — Landing, about, SEO, polish**
Landing with live-snippet cards, about page, metadata/sitemap/JSON-LD, keyboard shortcut popover, 404 page, favicon + OG images, Lighthouse pass.
✔ Check: §9 Lighthouse targets, all routes exported, README with deploy instructions for Vercel/Netlify/Cloudflare Pages.

---

## 13. Out of Scope for v1 (do not build)
- XSD schema validation, JSON Schema validation
- Shareable links / snippet storage (requires backend)
- User accounts, rate limiting, analytics
- YAML/CSV converters (roadmap candidates — keep architecture open via the `ParseResult` contract)
