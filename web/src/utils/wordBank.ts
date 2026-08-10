import type { WordEntry } from "../types";

export interface WordBankParseResult {
  words: WordEntry[];
  skippedLines: number;
  totalLines: number;
}

export function parseWordBank(text: string): WordBankParseResult {
  const lines = text.split(/\r?\n/);
  const words: WordEntry[] = [];
  let skippedLines = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;

    const parts = line.split("/").map((s) => s.trim()).filter(Boolean);
    const word = parts[0] ?? "";
    if (!word || word.length > 20) {
      skippedLines++;
      continue;
    }

    const aliases = parts.slice(1).filter((a) => a.length <= 20).slice(0, 10);
    words.push({ word, aliases });
  }

  return { words, skippedLines, totalLines: lines.length };
}
