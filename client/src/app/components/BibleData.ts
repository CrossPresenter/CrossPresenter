export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export const BIBLE_BOOKS = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation",
];

export const BOOK_ABBREV: Record<string, string> = {
  "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM", "Deuteronomy": "DEU", "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA", "1 Kings": "1KI", "2 Kings": "2KI", "1 Chronicles": "1CH", "2 Chronicles": "2CH", "Ezra": "EZR", "Nehemiah": "NEH", "Esther": "EST", "Job": "JOB", "Psalms": "PSA", "Proverbs": "PRO", "Ecclesiastes": "ECC", "Song of Solomon": "SNG", "Isaiah": "ISA", "Jeremiah": "JER", "Lamentations": "LAM", "Ezekiel": "EZK", "Daniel": "DAN", "Hosea": "HOS", "Joel": "JOL", "Amos": "AMO", "Obadiah": "OBA", "Jonah": "JON", "Micah": "MIC", "Nahum": "NAM", "Habakkuk": "HAB", "Zephaniah": "ZEP", "Haggai": "HAG", "Zechariah": "ZEC", "Malachi": "MAL",
  "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT", "Romans": "ROM", "1 Corinthians": "1CO", "2 Corinthians": "2CO", "Galatians": "GAL", "Ephesians": "EPH", "Philippians": "PHP", "Colossians": "COL", "1 Thessalonians": "1TH", "2 Thessalonians": "2TH", "1 Timothy": "1TI", "2 Timothy": "2TI", "Titus": "TIT", "Philemon": "PHM", "Hebrews": "HEB", "James": "JAS", "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN", "2 John": "2JN", "3 John": "3JN", "Jude": "JUD", "Revelation": "REV",
};

export const CHAPTERS: Record<string, number> = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34, Joshua: 24, Judges: 21, Ruth: 4, "1 Samuel": 31, "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36, Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalms: 150, Proverbs: 31, Ecclesiastes: 12, "Song of Solomon": 8, Isaiah: 66, Jeremiah: 52, Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9, Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3, Haggai: 2, Zechariah: 14, Malachi: 4,
  Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16, "1 Corinthians": 16, "2 Corinthians": 13, Galatians: 6, Ephesians: 6, Philippians: 4, Colossians: 4, "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, Titus: 3, Philemon: 1, Hebrews: 13, James: 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1, Jude: 1, Revelation: 22,
};

export const TAMIL_BIBLE_BOOKS_MAP: Record<string, string> = {
  "Genesis": "ஆதியாகமம்", "Exodus": "யாத்திராகமம்", "Leviticus": "லேவியராகமம்", "Numbers": "எண்ணாகமம்", "Deuteronomy": "உபாகமம்", "Joshua": "யோசுவா", "Judges": "நியாயாதிபதிகள்", "Ruth": "ரூத்", "1 Samuel": "1 சாமுவேல்", "2 Samuel": "2 சாமுவேல்", "1 Kings": "1 இராஜாக்கள்", "2 Kings": "2 இராஜாக்கள்", "1 Chronicles": "1 நாளாகமம்", "2 Chronicles": "2 நாளாகமம்", "Ezra": "எஸ்றா", "Nehemiah": "நெகேமியா", "Esther": "எஸ்தர்", "Job": "யோபு", "Psalms": "சங்கீதம்", "Proverbs": "நீதிமொழிகள்", "Ecclesiastes": "பிரசங்கி", "Song of Solomon": "உன்னதப்பாட்டு", "Isaiah": "ஏசாயா", "Jeremiah": "எரேமியா", "Lamentations": "புலம்பல்", "Ezekiel": "எசேக்கியேல்", "Daniel": "தானியேல்", "Hosea": "ஓசியா", "Joel": "யோவேல்", "Amos": "ஆமோஸ்", "Obadiah": "ஒபதியா", "Jonah": "யோனா", "Micah": "மீகா", "Nahum": "நாகூம்", "Habakkuk": "ஆபகூக்", "Zephaniah": "செப்பனியா", "Haggai": "ஆகாய்", "Zechariah": "சகரியா", "Malachi": "மல்கியா",
  "Matthew": "மத்தேயு", "Mark": "மாற்கு", "Luke": "லூக்கா", "John": "யோவான்", "Acts": "அப்போஸ்தலர் நடபடிகள்", "Romans": "ரோமர்", "1 Corinthians": "1 கொரிந்தியர்", "2 Corinthians": "2 கொரிந்தியர்", "Galatians": "கலாத்தியர்", "Ephesians": "எபேசியர்", "Philippians": "பிலிப்பியர்", "Colossians": "கொலோசெயர்", "1 Thessalonians": "1 தெசலோனிக்கேயர்", "2 Thessalonians": "2 தெசலோனிக்கேயர்", "1 Timothy": "1 தீமோத்தேயு", "2 Timothy": "2 தீமோத்தேயு", "Titus": "தீத்து", "Philemon": "பிலேமோன்", "Hebrews": "எபிரெயர்", "James": "யாக்கோபு", "1 Peter": "1 பேதுரு", "2 Peter": "2 பேதுரு", "1 John": "1 யோவான்", "2 John": "2 யோவான்", "3 John": "3 யோவான்", "Jude": "யூதா", "Revelation": "வெளிப்படுத்தின விசேஷம்"
};


const BIBLES: Record<string, Record<string, Record<number, Record<number, string>>>> = {
  tamil_bible: {},
};

let activeTranslationName = "nasb2020";
let isLoaded = false;

function parseTamil(json: any) {
  const data: Record<string, Record<number, Record<number, string>>> = {};
  if (json.Book && Array.isArray(json.Book)) {
    json.Book.forEach((bookObj: any, bIdx: number) => {
      const bookName = BIBLE_BOOKS[bIdx]; 
      if (!bookName) return;
      if (!data[bookName]) data[bookName] = {};
      bookObj.Chapter?.forEach((chapObj: any, cIdx: number) => {
        const chapNum = cIdx + 1;
        if (!data[bookName][chapNum]) data[bookName][chapNum] = {};
        chapObj.Verse?.forEach((vObj: any, vIdx: number) => {
          const verseNum = vIdx + 1;
          data[bookName][chapNum][verseNum] = vObj.Verse;
        });
      });
    });
  } else if (Array.isArray(json)) {
    Object.assign(data, json.books);
  } else {
    Object.assign(data, json);
  }
  return data;
}

export async function loadBuiltinBibles() {
  if (isLoaded) return;
  isLoaded = true;

  // NASB comes from the SQLite database (seeded by the main process). Tamil is
  // loaded via the main process because fetch() does not work on file:// URLs
  // in the packaged app.
  const win = (window as any).electron;
  if (win && win.getBibleJSON) {
    try {
      const tamilRaw = await win.getBibleJSON('tamil');
      if (tamilRaw) BIBLES.tamil_bible = parseTamil(tamilRaw);
      else console.error("Tamil bible data not available");
    } catch (e) {
      console.error("Could not load Tamil via IPC", e);
    }
    return;
  }

  // Browser/dev fallback (no Electron bridge available).
  try {
    const res = await fetch('./bibles/tamil.json?t=' + Date.now());
    if (res.ok) {
      BIBLES.tamil_bible = parseTamil(await res.json());
    } else {
      console.error("Tamil fetch failed with status:", res.status);
    }
  } catch (e) {
    console.error("Could not load Tamil:", e);
  }
}

export function setActiveTranslation(name: string) {
  activeTranslationName = name;
}

export function getVerses(book: string, chapter: number): number[] {
  if (activeTranslationName === "nasb2020" && (window as any).electron?.getVersesDB) {
    const verses = (window as any).electron.getVersesDB(book, chapter);
    if (verses && verses.length > 0) return verses;
  }
  const chapterData = BIBLES[activeTranslationName]?.[book]?.[chapter];
  if (chapterData) {
    return Object.keys(chapterData).map(Number).sort((a, b) => a - b);
  }
  return Array.from({ length: 20 }, (_, i) => i + 1);
}

export function getVerseText(book: string, chapter: number, verse: number): string {
  if (activeTranslationName === "nasb2020" && (window as any).electron?.getVerseTextDB) {
    const text = (window as any).electron.getVerseTextDB(book, chapter, verse);
    if (text) return text;
  }
  const text = BIBLES[activeTranslationName]?.[book]?.[chapter]?.[verse];
  if (text) return text;
  return `${book} ${chapter}:${verse} (Text not found in ${activeTranslationName})`;
}
