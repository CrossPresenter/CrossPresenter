import { BIBLE_BOOKS, BOOK_ABBREV } from "./BibleData";
import { BIBLE_GRID } from "./BibleBookGrid";

export interface ParsedBibleRef {
  book: string;      // canonical name, e.g. "Proverbs"
  chapter: number;
  verse: number;
  label: string;     // e.g. "Proverbs 29:4"
}

// Maps abbreviations (both BOOK_ABBREV 3-letter codes and BibleBookGrid spec
// abbreviations) to the canonical book name.
const ABBREV_TO_BOOK: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const b of BIBLE_BOOKS) {
    map[b.toLowerCase()] = b;
    map[b.toLowerCase().replace(/\s+/g, "")] = b;
    const code = BOOK_ABBREV[b];
    if (code) {
      map[code.toLowerCase()] = b;
      map[code.toLowerCase().replace(/\./g, "")] = b;
    }
  }
  for (const entry of BIBLE_GRID) {
    map[entry.abbrev.toLowerCase()] = entry.id;
    map[entry.abbrev.toLowerCase().replace(/\./g, "")] = entry.id;
  }
  return map;
})();

function resolveBook(token: string): string | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  if (ABBREV_TO_BOOK[t]) return ABBREV_TO_BOOK[t];
  // Prefix match on full book names (e.g. "proverb" -> "Proverbs").
  const match = BIBLE_BOOKS.find(b => b.toLowerCase().startsWith(t));
  return match || null;
}

export function parseBibleRef(query: string): ParsedBibleRef | null {
  const q = query.trim();
  if (!q) return null;

  // "John 3:16" or "John 3 16"
  const m = q.match(/^(.+?)\s+(\d+)\s*[:.-]\s*(\d+)$/) ||
            q.match(/^(.+?)\s+(\d+)\s+(\d+)$/);
  if (!m) return null;

  const bookToken = m[1].trim();
  const chapter = parseInt(m[2], 10);
  const verse = parseInt(m[3], 10);
  if (!Number.isFinite(chapter) || !Number.isFinite(verse)) return null;

  const book = resolveBook(bookToken);
  if (!book) return null;

  return { book, chapter, verse, label: `${book} ${chapter}:${verse}` };
}
