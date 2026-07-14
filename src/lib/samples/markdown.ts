/** A feature-rich, lint-clean Markdown sample for the editor's "Sample" button. */
export const MARKDOWN_SAMPLE = `# FormatWell Markdown

A live editor with a sanitized preview and lint hints — all in your browser.

## Features

- **GFM** tables, task lists, and strikethrough
- Fenced code blocks with syntax highlighting
- Autolinked URLs like <https://formatwell.app>

### Task list

- [x] Write the parser
- [x] Add the preview
- [ ] Ship it

### A table

| Tool     | Validates | Formats |
| -------- | :-------: | :-----: |
| JSON     |    yes    |   yes   |
| XML      |    yes    |   yes   |
| Markdown |   lint    | preview |

### Code

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

> Everything runs on your device. ~~Uploads~~ never happen.

Read more on the [about page](/about).
`;
