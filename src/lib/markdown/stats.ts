export interface MarkdownStats {
  words: number;
  characters: number;
  /** Whole minutes at ~200 words/minute, minimum 1 for non-empty text. */
  readingMinutes: number;
}

const WORDS_PER_MINUTE = 200;

export function markdownStats(input: string): MarkdownStats {
  const trimmed = input.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  return {
    words,
    characters: input.length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  };
}
