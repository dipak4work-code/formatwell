/**
 * Data for the JSON parse-error guide pages (/guides/<slug>). Each entry becomes a
 * statically exported page targeting the exact error strings developers search for.
 * Content notes: wording differs per engine (V8 / Firefox / Safari), so `browsers`
 * lists the variants a reader may have seen.
 */

export interface ErrorCause {
  title: string;
  body: string;
  bad?: string;
  good?: string;
}

export interface ErrorGuide {
  slug: string;
  /** Canonical error text — used as the page h1. */
  error: string;
  /** Engine-specific variants of the same error. */
  browsers: string[];
  metaTitle: string;
  metaDescription: string;
  meaning: string[];
  causes: ErrorCause[];
  fixes: string[];
  related: string[];
  /** Which tool the CTA points at. */
  tool: 'json' | 'jsonl';
}

export const JSON_ERROR_GUIDES: ErrorGuide[] = [
  {
    slug: 'unexpected-token-in-json-at-position-0',
    error: "Unexpected token '<' in JSON at position 0",
    browsers: [
      'Uncaught SyntaxError: Unexpected token < in JSON at position 0 (Chrome / Node.js)',
      'Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON (newer Chrome / Node.js)',
      'SyntaxError: JSON.parse: unexpected character at line 1 column 1 of the JSON data (Firefox)',
    ],
    metaTitle: "Unexpected token '<' in JSON at position 0 — causes & fix",
    metaDescription:
      "The most common JSON.parse error, explained: your code received HTML (usually an error page) instead of JSON. How to find the real response and fix it.",
    meaning: [
      'JSON can never start with a “<” character — but HTML always does. This error means your code called JSON.parse on something that is actually an HTML document, almost always an error page (404, 500, login redirect) returned where your code expected a JSON API response.',
      'The important insight: the bug is rarely in your parsing code. It is in what the server sent back.',
    ],
    causes: [
      {
        title: 'The API returned an error page instead of data',
        body: 'A wrong URL, a missing route, an expired session redirecting to a login page, or a server error all return HTML. Parsing that HTML throws this error. Log the raw response before parsing to see what actually came back.',
        bad: "const data = await fetch('/api/users').then((r) => r.json());\n// throws: Unexpected token '<' … when /api/users returns a 404 page",
        good: "const res = await fetch('/api/users');\nif (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);\nconst data = await res.json();",
      },
      {
        title: 'The dev server served index.html for an unknown path',
        body: 'Single-page-app dev servers (Vite, CRA, Next) respond to unknown paths with your index.html. If your API proxy is misconfigured, /api/... silently returns your app shell — which starts with <!DOCTYPE html>.',
      },
      {
        title: 'A proxy, CDN, or captive portal intercepted the request',
        body: 'Corporate proxies and hotel Wi-Fi login pages replace responses with HTML. Check the Content-Type header — if it is text/html, the body was never JSON.',
        good: "const type = res.headers.get('content-type') ?? '';\nif (!type.includes('application/json')) {\n  throw new Error(`Expected JSON, got ${type}`);\n}",
      },
    ],
    fixes: [
      'Open the request in the browser Network tab and look at the actual response body — it is almost certainly HTML.',
      'Check res.ok and res.status before calling res.json().',
      'Verify the URL, the HTTP method, and that auth headers or cookies are attached.',
      'Validate the Content-Type header is application/json before parsing.',
    ],
    related: ['unexpected-end-of-json-input', 'json-parse-unexpected-character-line-1-column-1'],
    tool: 'json',
  },
  {
    slug: 'unexpected-end-of-json-input',
    error: 'Unexpected end of JSON input',
    browsers: [
      'Uncaught SyntaxError: Unexpected end of JSON input (Chrome / Node.js)',
      'SyntaxError: JSON.parse: unexpected end of data at line 1 column 1 of the JSON data (Firefox)',
      'SyntaxError: JSON Parse error: Unexpected EOF (Safari)',
    ],
    metaTitle: 'Unexpected end of JSON input — causes & fix',
    metaDescription:
      'JSON.parse("") and truncated payloads both throw “Unexpected end of JSON input”. The three situations that produce it and how to guard against each.',
    meaning: [
      'The parser reached the end of the text while the JSON value was still incomplete. Two very different situations produce it: the input was empty (""), or the input was cut off mid-document — an unclosed brace, bracket, or string at the very end.',
    ],
    causes: [
      {
        title: 'You parsed an empty string',
        body: 'The most frequent case. A 204 No Content response, an empty request body, or a missing localStorage key that was stored as "" all hand JSON.parse an empty string.',
        bad: "JSON.parse(''); // throws immediately\nJSON.parse(localStorage.getItem('settings') ?? ''); // same problem",
        good: "const raw = localStorage.getItem('settings');\nconst settings = raw ? JSON.parse(raw) : defaultSettings;",
      },
      {
        title: 'The payload was truncated in transit',
        body: 'A network timeout, a killed process writing a file, or reading a file while it is still being written leaves you with the first half of a JSON document. The parser runs off the end and throws.',
      },
      {
        title: 'A response body was read before it finished streaming',
        body: 'Assembling a body from stream chunks and parsing before the stream closes parses a prefix of the document. Always await the full body (res.json() / res.text() already do this).',
      },
    ],
    fixes: [
      'Guard the empty case: if (!raw) return fallback.',
      'Wrap JSON.parse in try/catch and log the raw string length — 0 means empty input, > 0 means truncation.',
      'For files, verify the writer finished (write to a temp file, then rename).',
      'Paste the payload into a validator to see exactly where it stops being valid.',
    ],
    related: ['unexpected-token-in-json-at-position-0', 'expected-comma-or-closing-brace-after-property-value'],
    tool: 'json',
  },
  {
    slug: 'unexpected-token-o-in-json-at-position-1',
    error: 'Unexpected token o in JSON at position 1',
    browsers: [
      'Uncaught SyntaxError: Unexpected token o in JSON at position 1 (older Chrome / Node.js)',
      'Unexpected token \'o\', "[object Object]" is not valid JSON (newer Chrome / Node.js)',
    ],
    metaTitle: 'Unexpected token o in JSON at position 1 — causes & fix',
    metaDescription:
      'This error means you called JSON.parse on a JavaScript object instead of a JSON string — it was coerced to "[object Object]". Why it happens and the one-line fix.',
    meaning: [
      'JSON.parse expects a string. If you pass it a JavaScript object, the object is coerced to the string "[object Object]" first — and the “o” at position 1 is the second character of that string. In other words: the data was already parsed, and you parsed it twice.',
    ],
    causes: [
      {
        title: 'The value was already an object',
        body: 'Libraries like axios parse JSON for you (response.data is an object). Calling JSON.parse on it coerces the object to "[object Object]" and throws.',
        bad: 'const res = await axios.get(url);\nconst data = JSON.parse(res.data); // res.data is ALREADY an object',
        good: 'const res = await axios.get(url);\nconst data = res.data; // nothing to parse',
      },
      {
        title: 'You stored an object without stringifying it',
        body: 'localStorage.setItem coerces values to strings. Storing an object directly saves the literal text "[object Object]", which can never be parsed back.',
        bad: "localStorage.setItem('user', user); // saves \"[object Object]\"",
        good: "localStorage.setItem('user', JSON.stringify(user));\nconst user = JSON.parse(localStorage.getItem('user') ?? 'null');",
      },
    ],
    fixes: [
      'Check the type first: only parse when typeof value === "string".',
      'Find the double-parse: if the value came from res.json(), axios, or a message handler, it is already an object.',
      'When storing, always JSON.stringify; when reading, always JSON.parse — never mix the two conventions.',
    ],
    related: ['unexpected-end-of-json-input', 'unexpected-token-in-json-at-position-0'],
    tool: 'json',
  },
  {
    slug: 'expected-property-name-or-closing-brace',
    error: "Expected property name or '}' in JSON at position 1",
    browsers: [
      "Uncaught SyntaxError: Expected property name or '}' in JSON at position 1 (Chrome / Node.js)",
      'SyntaxError: JSON.parse: expected property name or \'}\' at line 1 column 2 of the JSON data (Firefox)',
    ],
    metaTitle: "Expected property name or '}' in JSON — causes & fix",
    metaDescription:
      'Unquoted keys and single quotes are valid JavaScript but invalid JSON. Why {a: 1} and {\'a\': 1} throw this error, and how to convert them to strict JSON.',
    meaning: [
      'Right after an opening brace, JSON allows exactly two things: a double-quoted property name, or a closing brace. This error means the parser found something else — usually an unquoted key or a single-quoted key. That is valid JavaScript object syntax, but JSON is stricter.',
    ],
    causes: [
      {
        title: 'Unquoted property names',
        body: 'JavaScript lets you write {a: 1}; JSON requires every key in double quotes.',
        bad: '{ a: 1, b: 2 }',
        good: '{ "a": 1, "b": 2 }',
      },
      {
        title: 'Single quotes instead of double quotes',
        body: 'Single quotes are not JSON — not for keys and not for string values. This bites hardest when hand-writing JSON in shell commands or Python (where single quotes are idiomatic).',
        bad: "{ 'name': 'Ada' }",
        good: '{ "name": "Ada" }',
      },
      {
        title: 'A JavaScript object literal pasted as JSON',
        body: 'Copying an object out of source code or a console brings JS-only syntax with it: unquoted keys, trailing commas, comments, undefined. It needs converting, not just quoting.',
      },
    ],
    fixes: [
      'Wrap every key in double quotes.',
      'Replace all single quotes with double quotes (escape inner quotes as \\").',
      'Remove comments, trailing commas, and undefined — none exist in JSON.',
      'If the data comes from code, produce it with JSON.stringify instead of copying literals.',
    ],
    related: ['expected-double-quoted-property-name', 'expected-comma-or-closing-brace-after-property-value'],
    tool: 'json',
  },
  {
    slug: 'expected-double-quoted-property-name',
    error: 'Expected double-quoted property name in JSON',
    browsers: [
      'Uncaught SyntaxError: Expected double-quoted property name in JSON at position 8 (Chrome / Node.js)',
      'SyntaxError: JSON.parse: expected double-quoted property name at line 1 column 9 of the JSON data (Firefox)',
    ],
    metaTitle: 'Expected double-quoted property name in JSON — causes & fix',
    metaDescription:
      'Usually a trailing comma: {"a": 1,} makes the parser expect another "key" after the comma. All the ways this error appears and how to fix each.',
    meaning: [
      'After a comma inside an object, the parser expects the next property name in double quotes. The classic trigger is a trailing comma before the closing brace — the comma promises another property that never arrives.',
    ],
    causes: [
      {
        title: 'A trailing comma before }',
        body: 'Trailing commas are fine in modern JavaScript and in JSON5 config files, but the JSON standard (RFC 8259) forbids them.',
        bad: '{\n  "a": 1,\n  "b": 2,\n}',
        good: '{\n  "a": 1,\n  "b": 2\n}',
      },
      {
        title: 'Keys quoted with the wrong characters',
        body: 'Single quotes, backticks, or “smart quotes” pasted from a chat app or word processor all fail. Only straight double quotes (") are JSON.',
        bad: '{ “a”: 1 }',
        good: '{ "a": 1 }',
      },
      {
        title: 'A comment where a key should be',
        body: 'JSON has no comments. Tools like tsconfig.json accept them (that is JSONC), which trains people to expect they work everywhere.',
      },
    ],
    fixes: [
      'Delete the comma after the last property in every object and array.',
      'Replace curly/smart quotes with straight double quotes — re-type them if you pasted from a document.',
      'Strip // and /* */ comments.',
    ],
    related: ['expected-property-name-or-closing-brace', 'expected-comma-or-closing-brace-after-property-value'],
    tool: 'json',
  },
  {
    slug: 'expected-comma-or-closing-brace-after-property-value',
    error: "Expected ',' or '}' after property value in JSON",
    browsers: [
      "Uncaught SyntaxError: Expected ',' or '}' after property value in JSON at position 27 (Chrome / Node.js)",
      "SyntaxError: JSON.parse: expected ',' or '}' after property value in object at line 3 column 3 of the JSON data (Firefox)",
    ],
    metaTitle: "Expected ',' or '}' after property value in JSON — causes & fix",
    metaDescription:
      'A missing comma between properties or unquoted string values make the parser stop right after a value. How to read the position and fix the document.',
    meaning: [
      'After a property value, only two characters can follow: a comma (more properties coming) or a closing brace (object ends). The parser found something else — which nearly always means a missing comma on the line above, or a value that needed quotes.',
    ],
    causes: [
      {
        title: 'Missing comma between properties',
        body: 'The error points at the start of the NEXT property, but the actual mistake is the missing comma at the end of the previous line.',
        bad: '{\n  "a": 1\n  "b": 2\n}',
        good: '{\n  "a": 1,\n  "b": 2\n}',
      },
      {
        title: 'An unquoted string value',
        body: 'A bare word after the colon parses as far as it can, then fails. Strings must be double-quoted; only numbers, true, false, null, objects, and arrays may appear bare.',
        bad: '{ "status": active }',
        good: '{ "status": "active" }',
      },
      {
        title: 'Concatenation gone wrong',
        body: 'Hand-building JSON with string concatenation or templates easily drops a comma or a quote. Build the object in code and JSON.stringify it instead.',
      },
    ],
    fixes: [
      'Look one line ABOVE the reported line/column — that is where the comma is missing.',
      'Quote every string value with double quotes.',
      'Never assemble JSON by hand in strings; use JSON.stringify.',
    ],
    related: ['expected-double-quoted-property-name', 'unexpected-end-of-json-input'],
    tool: 'json',
  },
  {
    slug: 'unexpected-non-whitespace-character-after-json',
    error: 'Unexpected non-whitespace character after JSON',
    browsers: [
      'Uncaught SyntaxError: Unexpected non-whitespace character after JSON at position 17 (Chrome / Node.js)',
      'SyntaxError: JSON.parse: unexpected non-whitespace character after JSON data at line 2 column 1 of the JSON data (Firefox)',
    ],
    metaTitle: 'Unexpected non-whitespace character after JSON — causes & fix',
    metaDescription:
      'A complete JSON value followed by more content: concatenated API responses, log lines, or a JSONL file parsed as JSON. What it means and how to handle each case.',
    meaning: [
      'The parser successfully read one complete JSON value — and then found more content after it. A JSON document must be exactly one value; anything after it (except whitespace) is an error.',
      'This error is special: your data may not be broken at all. It may simply be JSON Lines (JSONL/NDJSON) — a format where every line is its own JSON value.',
    ],
    causes: [
      {
        title: 'The file is JSONL, not JSON',
        body: 'Log exports, LLM training data, and streaming APIs commonly emit one JSON object per line. JSON.parse reads the first line, then chokes on the second. Parse it line by line instead — or use a JSONL validator.',
        bad: '{"event":"start"}\n{"event":"end"}  ← valid JSONL, invalid JSON',
        good: 'const records = text\n  .split("\\n")\n  .filter(Boolean)\n  .map((line) => JSON.parse(line));',
      },
      {
        title: 'Two responses or objects concatenated',
        body: 'Appending API responses into one buffer or file without separators produces {"a":1}{"a":2}. Either store them as an array, or write one per line (JSONL).',
      },
      {
        title: 'Trailing garbage after the document',
        body: 'A stray character, a duplicated closing brace from a bad merge, or logging noise appended after the JSON. The position in the error tells you exactly where the extra content starts.',
      },
    ],
    fixes: [
      'If every line looks like its own JSON object — it is JSONL; validate it as JSONL and parse per line.',
      'Check the reported position: everything before it is valid, so inspect what follows.',
      'When accumulating multiple values, wrap them in an array or emit newline-delimited records.',
    ],
    related: ['unexpected-end-of-json-input', 'unexpected-token-in-json-at-position-0'],
    tool: 'jsonl',
  },
  {
    slug: 'json-parse-unexpected-character-line-1-column-1',
    error: 'JSON.parse: unexpected character at line 1 column 1',
    browsers: [
      'SyntaxError: JSON.parse: unexpected character at line 1 column 1 of the JSON data (Firefox)',
      "Uncaught SyntaxError: Unexpected token  in JSON at position 0 (Chrome, with an invisible character)",
    ],
    metaTitle: 'JSON.parse: unexpected character at line 1 column 1 — causes & fix',
    metaDescription:
      'When the very first character is wrong: HTML responses, a UTF-8 BOM, invisible characters, or a completely different format. How to diagnose each in seconds.',
    meaning: [
      'The document failed at the very first character — the parser could not even start. Either the content is not JSON at all (HTML, XML, plain text), or an invisible character such as a UTF-8 byte-order mark (BOM) sits in front of your data.',
    ],
    causes: [
      {
        title: 'The response is not JSON',
        body: 'An HTML error page, an XML feed, or plain text. Log the first 100 characters of the raw string — the answer is usually obvious.',
      },
      {
        title: 'A UTF-8 BOM at the start of the file',
        body: 'Some editors (and Windows tools like PowerShell’s Out-File) write an invisible byte-order mark (\\uFEFF) before the first character. It is invisible in editors but fatal to JSON.parse.',
        bad: 'JSON.parse(fileText); // fileText starts with an invisible \\uFEFF',
        good: "JSON.parse(fileText.replace(/^\\uFEFF/, ''));",
      },
      {
        title: 'Invisible or non-breaking characters from copy-paste',
        body: 'Zero-width spaces and non-breaking spaces travel along when copying from chats, PDFs, and rendered web pages. They look like nothing and parse like poison.',
      },
    ],
    fixes: [
      'Print JSON.stringify(raw.slice(0, 20)) — invisible characters become visible escapes like "\\uFEFF".',
      'Strip a BOM before parsing, or save the file as “UTF-8 without BOM”.',
      'Re-type the first character manually if the input was pasted from a formatted source.',
    ],
    related: ['unexpected-token-in-json-at-position-0', 'expected-property-name-or-closing-brace'],
    tool: 'json',
  },
];

export function getGuide(slug: string): ErrorGuide | undefined {
  return JSON_ERROR_GUIDES.find((g) => g.slug === slug);
}
