export type BibleBookCategory =
  | "law"
  | "history"
  | "poetry"
  | "prophets"
  | "minorProphets"
  | "gospels"
  | "epistles"
  | "revelation";

export interface BibleBookEntry {
  id: string;      // canonical name used for verse lookup, e.g. "Genesis"
  abbrev: string;  // standard English short label, e.g. "Gen."
  chapters: number;
  category: BibleBookCategory;
  bg: string;
  color: string;
}

export const BIBLE_GRID_COLORS: Record<BibleBookCategory, string> = {
  law: "#857200",
  history: "#8F4F00",
  poetry: "#1E5E2F",
  prophets: "#722253",
  minorProphets: "#0F5257",
  gospels: "#7A6000",
  epistles: "#4A2E80",
  revelation: "#8C1D40",
};

const law = { bg: "#857200", color: "#FFFFFF", category: "law" as BibleBookCategory };
const history = { bg: "#8F4F00", color: "#FFFFFF", category: "history" as BibleBookCategory };
const poetry = { bg: "#1E5E2F", color: "#FFFFFF", category: "poetry" as BibleBookCategory };
const prophets = { bg: "#722253", color: "#FFFFFF", category: "prophets" as BibleBookCategory };
const minorProphets = { bg: "#0F5257", color: "#FFFFFF", category: "minorProphets" as BibleBookCategory };
const gospels = { bg: "#7A6000", color: "#FFFFFF", category: "gospels" as BibleBookCategory };
const epistles = { bg: "#4A2E80", color: "#FFFFFF", category: "epistles" as BibleBookCategory };
const revelation = { bg: "#8C1D40", color: "#FFFFFF", category: "revelation" as BibleBookCategory };

export const BIBLE_GRID: BibleBookEntry[] = [
  { id: "Genesis", abbrev: "Gen.", chapters: 50, ...law },
  { id: "Exodus", abbrev: "Exod.", chapters: 40, ...law },
  { id: "Leviticus", abbrev: "Lev.", chapters: 27, ...law },
  { id: "Numbers", abbrev: "Num.", chapters: 36, ...law },
  { id: "Deuteronomy", abbrev: "Deut.", chapters: 34, ...law },
  { id: "Joshua", abbrev: "Josh.", chapters: 24, ...history },
  { id: "Judges", abbrev: "Judg.", chapters: 21, ...history },
  { id: "Ruth", abbrev: "Ruth", chapters: 4, ...history },
  { id: "1 Samuel", abbrev: "1 Sam.", chapters: 31, ...history },
  { id: "2 Samuel", abbrev: "2 Sam.", chapters: 24, ...history },
  { id: "1 Kings", abbrev: "1 Kgs.", chapters: 22, ...history },
  { id: "2 Kings", abbrev: "2 Kgs.", chapters: 25, ...history },
  { id: "1 Chronicles", abbrev: "1 Chron.", chapters: 29, ...history },
  { id: "2 Chronicles", abbrev: "2 Chron.", chapters: 36, ...history },
  { id: "Ezra", abbrev: "Ezra", chapters: 10, ...history },
  { id: "Nehemiah", abbrev: "Neh.", chapters: 13, ...history },
  { id: "Esther", abbrev: "Esth.", chapters: 10, ...history },
  { id: "Job", abbrev: "Job", chapters: 42, ...poetry },
  { id: "Psalms", abbrev: "Ps.", chapters: 150, ...poetry },
  { id: "Proverbs", abbrev: "Prov.", chapters: 31, ...poetry },
  { id: "Ecclesiastes", abbrev: "Eccl.", chapters: 12, ...poetry },
  { id: "Song of Solomon", abbrev: "Song", chapters: 8, ...poetry },
  { id: "Isaiah", abbrev: "Isa.", chapters: 66, ...prophets },
  { id: "Jeremiah", abbrev: "Jer.", chapters: 52, ...prophets },
  { id: "Lamentations", abbrev: "Lam.", chapters: 5, ...prophets },
  { id: "Ezekiel", abbrev: "Ezek.", chapters: 48, ...prophets },
  { id: "Daniel", abbrev: "Dan.", chapters: 12, ...prophets },
  { id: "Hosea", abbrev: "Hos.", chapters: 14, ...minorProphets },
  { id: "Joel", abbrev: "Joel", chapters: 3, ...minorProphets },
  { id: "Amos", abbrev: "Amos", chapters: 9, ...minorProphets },
  { id: "Obadiah", abbrev: "Obad.", chapters: 1, ...minorProphets },
  { id: "Jonah", abbrev: "Jonah", chapters: 4, ...minorProphets },
  { id: "Micah", abbrev: "Mic.", chapters: 7, ...minorProphets },
  { id: "Nahum", abbrev: "Nah.", chapters: 3, ...minorProphets },
  { id: "Habakkuk", abbrev: "Hab.", chapters: 3, ...minorProphets },
  { id: "Zephaniah", abbrev: "Zeph.", chapters: 3, ...minorProphets },
  { id: "Haggai", abbrev: "Hag.", chapters: 2, ...minorProphets },
  { id: "Zechariah", abbrev: "Zech.", chapters: 14, ...minorProphets },
  { id: "Malachi", abbrev: "Mal.", chapters: 4, ...minorProphets },
  { id: "Matthew", abbrev: "Matt.", chapters: 28, ...gospels },
  { id: "Mark", abbrev: "Mark", chapters: 16, ...gospels },
  { id: "Luke", abbrev: "Luke", chapters: 24, ...gospels },
  { id: "John", abbrev: "John", chapters: 21, ...gospels },
  { id: "Acts", abbrev: "Acts", chapters: 28, ...gospels },
  { id: "Romans", abbrev: "Rom.", chapters: 16, ...epistles },
  { id: "1 Corinthians", abbrev: "1 Cor.", chapters: 16, ...epistles },
  { id: "2 Corinthians", abbrev: "2 Cor.", chapters: 13, ...epistles },
  { id: "Galatians", abbrev: "Gal.", chapters: 6, ...epistles },
  { id: "Ephesians", abbrev: "Eph.", chapters: 6, ...epistles },
  { id: "Philippians", abbrev: "Phil.", chapters: 4, ...epistles },
  { id: "Colossians", abbrev: "Col.", chapters: 4, ...epistles },
  { id: "1 Thessalonians", abbrev: "1 Thess.", chapters: 5, ...epistles },
  { id: "2 Thessalonians", abbrev: "2 Thess.", chapters: 3, ...epistles },
  { id: "1 Timothy", abbrev: "1 Tim.", chapters: 6, ...epistles },
  { id: "2 Timothy", abbrev: "2 Tim.", chapters: 4, ...epistles },
  { id: "Titus", abbrev: "Titus", chapters: 3, ...epistles },
  { id: "Philemon", abbrev: "Phlm.", chapters: 1, ...epistles },
  { id: "Hebrews", abbrev: "Heb.", chapters: 13, ...epistles },
  { id: "James", abbrev: "Jas.", chapters: 5, ...epistles },
  { id: "1 Peter", abbrev: "1 Pet.", chapters: 5, ...epistles },
  { id: "2 Peter", abbrev: "2 Pet.", chapters: 3, ...epistles },
  { id: "1 John", abbrev: "1 John", chapters: 5, ...epistles },
  { id: "2 John", abbrev: "2 John", chapters: 1, ...epistles },
  { id: "3 John", abbrev: "3 John", chapters: 1, ...epistles },
  { id: "Jude", abbrev: "Jude", chapters: 1, ...epistles },
  { id: "Revelation", abbrev: "Rev.", chapters: 22, ...revelation },
];

// Row groupings: 4 full-width equal rows (17/17/16/16). Every row spans 100%
// of the container width via `flex: 1` on each button.
const byAbbrev = (abbrev: string): BibleBookEntry =>
  BIBLE_GRID.find(b => b.abbrev === abbrev)!;

const ROWS: BibleBookEntry[][] = [
  // Row 1: 17 books — Law & History (Gen. .. Esth.)
  ["Gen.", "Exod.", "Lev.", "Num.", "Deut.", "Josh.", "Judg.", "Ruth", "1 Sam.", "2 Sam.", "1 Kgs.", "2 Kgs.", "1 Chron.", "2 Chron.", "Ezra", "Neh.", "Esth."].map(byAbbrev),
  // Row 2: 17 books — Poetry & Prophets (Job .. Nah.)
  ["Job", "Ps.", "Prov.", "Eccl.", "Song", "Isa.", "Jer.", "Lam.", "Ezek.", "Dan.", "Hos.", "Joel", "Amos", "Obad.", "Jonah", "Mic.", "Nah."].map(byAbbrev),
  // Row 3: 16 books — Minor Prophets end, Gospels, Acts & Epistles (Hab. .. Phil.)
  ["Hab.", "Zeph.", "Hag.", "Zech.", "Mal.", "Matt.", "Mark", "Luke", "John", "Acts", "Rom.", "1 Cor.", "2 Cor.", "Gal.", "Eph.", "Phil."].map(byAbbrev),
  // Row 4: 16 books — Remaining Epistles & Revelation (Col. .. Rev.)
  ["Col.", "1 Thess.", "2 Thess.", "1 Tim.", "2 Tim.", "Titus", "Phlm.", "Heb.", "Jas.", "1 Pet.", "2 Pet.", "1 John", "2 John", "3 John", "Jude", "Rev."].map(byAbbrev),
];

interface BibleBookGridProps {
  active?: string | null;
  onSelect: (book: string) => void;
}

// Dark-theme, centered-row 66-book selector. Standard English abbreviations on
// the tiles; the book's canonical name is used for verse lookup.
export function BibleBookGrid({ active, onSelect }: BibleBookGridProps) {
  const buttonStyle = (book: BibleBookEntry, isActive: boolean): React.CSSProperties => ({
    backgroundColor: book.bg,
    color: book.color,
    border: `1px solid ${isActive ? "rgba(124,106,247,0.9)" : "rgba(255,255,255,0.15)"}`,
    borderRadius: "4px",
    flex: 1,
    minWidth: 0,
    height: "100%",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    padding: "2px 2px",
    boxShadow: isActive
      ? "0 0 0 2px rgba(124,106,247,0.5), 0 1px 2px rgba(0,0,0,0.4)"
      : "0 1px 2px rgba(0,0,0,0.4)",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  });

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#181825",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        padding: "12px",
        boxSizing: "border-box",
        height: "100%",
      }}
    >
      <div style={{ fontWeight: "bold", color: "#89B4FA", marginBottom: "8px", fontSize: "13px", textAlign: "center" }}>
        Books
      </div>

      {ROWS.map((row, rIdx) => (
        <div
          key={`row-${rIdx}`}
          style={{ display: "flex", width: "100%", gap: "3px", marginBottom: rIdx === ROWS.length - 1 ? 0 : "3px", flex: 1 }}
        >
          {row.map((book) => {
            const isActive = book.id === active;
            return (
              <button
                key={book.id}
                type="button"
                style={buttonStyle(book, isActive)}
                title={`${book.id} (${book.chapters} chapters)`}
                onClick={() => onSelect(book.id)}
              >
                {book.abbrev}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
