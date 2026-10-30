/**
 * Language-aware search keys.
 *
 * Operators type song titles in whatever script they have on their keyboard:
 * `yesu`, `இயேசு`, `yēsu`, `येसु`, `യേശു`. A plain `String.includes` only
 * matches the exact script and spelling, which is useless for a bilingual
 * library.
 *
 * Every string is reduced to two keys:
 *
 * - `basic`    — case/diacritic-folded, punctuation normalised. Matches any
 *                script exactly (CJK, Arabic, Tamil, …) without needing a
 *                romanisation table.
 * - `phonetic` — the same text transliterated to Latin and reduced to a loose
 *                phonetic spelling, so `yesu` finds `இயேசு` and `tamil` finds
 *                `தமிழ்`.
 *
 * Matching then tries substring, word-prefix and (for terms of 3+ characters)
 * subsequence matches, so typos and dropped vowels still land on the song.
 */

/** How a segment of an Indic block maps to Latin. Offsets are relative to `start`. */
interface IndicScript {
  /** First code point of the Unicode block. */
  start: number;
  /** Independent vowels. */
  vowels: Record<number, string>;
  /** Consonants, written without the inherent vowel. */
  consonants: Record<number, string>;
  /** Dependent vowel signs (matras); they replace the inherent `a`. */
  matras: Record<number, string>;
  /** Offset of the virama (vowel suppressor). */
  virama: number;
  /** Anusvara / candrabindu / visarga. */
  signs?: Record<number, string>;
  /** Offset of the script's digit zero, when it has its own digits. */
  digits?: number;
  /** Precomposed letters outside the regular vowel/consonant ranges. */
  extras?: Record<number, string>;
}

/**
 * Letter mappings use short, informal romanisation (`aa` → `a`, `ee` → `e`)
 * because that is what people actually type. The Tamil ச maps to `s` so
 * `இயேசு` becomes `iyesu` and a `yesu` query still matches as a substring.
 */
const TAMIL: IndicScript = {
  start: 0x0b80,
  vowels: {
    0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u",
    0x0e: "e", 0x0f: "e", 0x10: "ai", 0x12: "o", 0x13: "o", 0x14: "au",
  },
  consonants: {
    0x15: "k", 0x19: "ng", 0x1a: "s", 0x1c: "j", 0x1e: "ny",
    0x1f: "t", 0x23: "n", 0x24: "t", 0x28: "n", 0x29: "n",
    0x2a: "p", 0x2e: "m", 0x2f: "y", 0x30: "r", 0x31: "r",
    0x32: "l", 0x33: "l", 0x34: "zh", 0x35: "v",
    0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  },
  matras: {
    0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u",
    0x46: "e", 0x47: "e", 0x48: "ai", 0x4a: "o", 0x4b: "o", 0x4c: "au",
  },
  virama: 0x4d,
  signs: { 0x02: "m", 0x03: "h" },
  digits: 0x66,
  extras: { 0x50: "om" },
};

const DEVANAGARI: IndicScript = {
  start: 0x0900,
  vowels: {
    0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u",
    0x0b: "ri", 0x0c: "ri", 0x0d: "li", 0x0e: "li",
    0x0f: "e", 0x10: "ai", 0x11: "o", 0x12: "o", 0x13: "o", 0x14: "au",
  },
  consonants: {
    0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
    0x1a: "c", 0x1b: "ch", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
    0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
    0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n", 0x29: "n",
    0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
    0x2f: "y", 0x30: "r", 0x31: "r", 0x32: "l", 0x33: "l", 0x34: "l",
    0x35: "v", 0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  },
  matras: {
    0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u",
    0x43: "ri", 0x44: "ri", 0x45: "li", 0x46: "li",
    0x47: "e", 0x48: "ai", 0x49: "o", 0x4a: "o", 0x4b: "o", 0x4c: "au",
  },
  virama: 0x4d,
  signs: { 0x01: "m", 0x02: "m", 0x03: "h" },
  digits: 0x66,
  extras: {
    0x58: "q", 0x59: "kh", 0x5a: "g", 0x5b: "z",
    0x5c: "r", 0x5d: "r", 0x5e: "f", 0x5f: "y",
  },
};

const BENGALI: IndicScript = {
  start: 0x0980,
  vowels: {
    0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u",
    0x0b: "ri", 0x0c: "li", 0x0f: "e", 0x10: "ai", 0x13: "o", 0x14: "au",
  },
  consonants: {
    0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
    0x1a: "c", 0x1b: "ch", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
    0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
    0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n",
    0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
    0x2f: "y", 0x30: "r", 0x32: "l", 0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  },
  matras: {
    0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u",
    0x43: "ri", 0x44: "ri", 0x47: "e", 0x48: "ai", 0x4a: "o", 0x4b: "o", 0x4c: "au",
  },
  virama: 0x4d,
  signs: { 0x01: "m", 0x02: "m", 0x03: "h" },
  digits: 0x66,
  extras: { 0x4e: "t", 0x5c: "r", 0x5d: "r", 0x5f: "y" },
};

const GURMUKHI: IndicScript = {
  start: 0x0a00,
  vowels: {
    0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u",
    0x0f: "e", 0x10: "ai", 0x13: "o", 0x14: "au",
  },
  consonants: {
    0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
    0x1a: "c", 0x1b: "ch", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
    0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
    0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n",
    0x29: "p", 0x2a: "ph", 0x2b: "b", 0x2c: "bh", 0x2d: "m",
    0x2e: "y", 0x2f: "r", 0x30: "l", 0x32: "l", 0x35: "v",
    0x36: "sh", 0x38: "s", 0x39: "h",
  },
  matras: {
    0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u",
    0x47: "e", 0x48: "ai", 0x4a: "o", 0x4b: "o", 0x4c: "au",
  },
  virama: 0x4d,
  signs: { 0x01: "m", 0x02: "m", 0x03: "h" },
  digits: 0x66,
  extras: { 0x5c: "r" },
};

const GUJARATI: IndicScript = {
  start: 0x0a80,
  vowels: {
    0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u",
    0x0b: "ri", 0x0c: "ri", 0x0d: "li", 0x0e: "li",
    0x0f: "e", 0x10: "ai", 0x11: "o", 0x12: "o", 0x13: "o", 0x14: "au",
  },
  consonants: {
    0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
    0x1a: "c", 0x1b: "ch", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
    0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
    0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n",
    0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
    0x2f: "y", 0x30: "r", 0x32: "l", 0x33: "l", 0x35: "v",
    0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  },
  matras: {
    0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u",
    0x43: "ri", 0x44: "ri", 0x45: "li", 0x46: "li",
    0x47: "e", 0x48: "ai", 0x49: "o", 0x4a: "o", 0x4b: "o", 0x4c: "au",
  },
  virama: 0x4d,
  signs: { 0x01: "m", 0x02: "m", 0x03: "h" },
  digits: 0x66,
};

const ODIA: IndicScript = {
  start: 0x0b00,
  vowels: {
    0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u",
    0x0b: "ri", 0x0c: "li", 0x0f: "e", 0x10: "ai", 0x13: "o", 0x14: "au",
  },
  consonants: {
    0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
    0x1a: "c", 0x1b: "ch", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
    0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
    0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n",
    0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
    0x2f: "y", 0x30: "r", 0x32: "l", 0x33: "l", 0x35: "v",
    0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  },
  matras: {
    0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u",
    0x43: "ri", 0x44: "ri", 0x47: "e", 0x48: "ai", 0x4a: "o", 0x4b: "o", 0x4c: "au",
  },
  virama: 0x4d,
  signs: { 0x01: "m", 0x02: "m", 0x03: "h" },
  digits: 0x66,
  extras: { 0x5c: "r", 0x5d: "r", 0x5f: "y", 0x71: "v" },
};

const TELUGU: IndicScript = {
  start: 0x0c00,
  vowels: {
    0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u",
    0x0b: "ri", 0x0c: "li", 0x0e: "e", 0x0f: "e", 0x10: "ai", 0x12: "o", 0x13: "o", 0x14: "au",
  },
  consonants: {
    0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
    0x1a: "c", 0x1b: "ch", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
    0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
    0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n",
    0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
    0x2f: "y", 0x30: "r", 0x31: "r", 0x32: "l", 0x33: "l", 0x34: "l",
    0x35: "v", 0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  },
  matras: {
    0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u",
    0x43: "ri", 0x44: "ri", 0x46: "e", 0x47: "e", 0x48: "ai", 0x4a: "o", 0x4b: "o", 0x4c: "au",
  },
  virama: 0x4d,
  signs: { 0x01: "m", 0x02: "m", 0x03: "h" },
  digits: 0x66,
};

const KANNADA: IndicScript = {
  start: 0x0c80,
  vowels: {
    0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u",
    0x0b: "ri", 0x0c: "ri", 0x0d: "li", 0x0e: "li",
    0x0f: "e", 0x10: "e", 0x11: "ai", 0x12: "o", 0x13: "o", 0x14: "au",
  },
  consonants: {
    0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
    0x1a: "c", 0x1b: "ch", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
    0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
    0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n",
    0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
    0x2f: "y", 0x30: "r", 0x31: "r", 0x32: "l", 0x33: "l", 0x34: "l",
    0x35: "v", 0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  },
  matras: {
    0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u",
    0x43: "ri", 0x44: "ri", 0x46: "e", 0x47: "e", 0x48: "ai", 0x4a: "o", 0x4b: "o", 0x4c: "au",
  },
  virama: 0x4d,
  signs: { 0x02: "m", 0x03: "h" },
  digits: 0x66,
};

const MALAYALAM: IndicScript = {
  start: 0x0d00,
  vowels: {
    0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u",
    0x0b: "ri", 0x0c: "ri", 0x0d: "li", 0x0e: "li",
    0x0f: "e", 0x10: "e", 0x11: "ai", 0x12: "o", 0x13: "o", 0x14: "au",
  },
  consonants: {
    0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
    0x1a: "c", 0x1b: "ch", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
    0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
    0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n", 0x29: "n",
    0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
    0x2f: "y", 0x30: "r", 0x31: "r", 0x32: "l", 0x33: "l", 0x34: "zh",
    0x35: "v", 0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  },
  matras: {
    0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u",
    0x43: "ri", 0x44: "ri", 0x46: "e", 0x47: "e", 0x48: "ai", 0x4a: "o", 0x4b: "o", 0x4c: "au",
  },
  virama: 0x4d,
  signs: { 0x01: "m", 0x02: "m", 0x03: "h" },
  digits: 0x66,
};

const INDIC_SCRIPTS = [
  TAMIL,
  DEVANAGARI,
  BENGALI,
  GURMUKHI,
  GUJARATI,
  ODIA,
  TELUGU,
  KANNADA,
  MALAYALAM,
];

/** Scripts written with letters (not CJK/Arabic), folded to Latin for search. */
const LETTER_MAP: Record<string, string> = {
  // Cyrillic — Russian, Ukrainian, Serbian, Bulgarian church songs.
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  і: "i", ї: "yi", є: "e", ґ: "g", ў: "u", ђ: "dj", ј: "j", љ: "lj",
  њ: "nj", ћ: "c", џ: "dz",
  // Greek — New Testament names and Greek hymns.
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r",
  σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
  // Latin letters that NFKD does not reduce to ASCII on its own.
  ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ð: "d", þ: "th", ł: "l", ı: "i",
};

function scriptFor(codePoint: number): IndicScript | undefined {
  return INDIC_SCRIPTS.find(
    (script) => codePoint >= script.start && codePoint < script.start + 0x80,
  );
}

/** Transliterate one non-Indic character, recursing through compatibility forms. */
function latiniseChar(char: string): string | null {
  const mapped = LETTER_MAP[char];
  if (mapped !== undefined) return mapped;

  const decomposed = char.normalize("NFKD");
  if (decomposed !== char) {
    let out = "";
    for (const part of decomposed) out += latiniseChar(part) ?? part;
    return out;
  }

  return null;
}

function transliterate(text: string): string {
  let out = "";
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;

    const script = scriptFor(codePoint);
    if (!script) {
      out += latiniseChar(char) ?? char;
      continue;
    }

    const offset = codePoint - script.start;
    const extra = script.extras?.[offset];
    if (extra !== undefined) {
      out += extra;
      continue;
    }

    const vowel = script.vowels[offset];
    if (vowel !== undefined) {
      out += vowel;
      continue;
    }

    const consonant = script.consonants[offset];
    if (consonant !== undefined) {
      out += `${consonant}a`;
      continue;
    }

    const matra = script.matras[offset];
    if (matra !== undefined) {
      // A matra replaces the inherent `a` emitted with the consonant.
      out = out.endsWith("a") ? `${out.slice(0, -1)}${matra}` : `${out}${matra}`;
      continue;
    }

    if (offset === script.virama) {
      out = out.endsWith("a") ? out.slice(0, -1) : out;
      continue;
    }

    const sign = script.signs?.[offset];
    if (sign !== undefined) {
      out += sign;
      continue;
    }

    if (script.digits !== undefined && offset >= script.digits && offset <= script.digits + 9) {
      out += String(offset - script.digits);
      continue;
    }

    // Unknown combining mark or unassigned code point: drop it rather than
    // letting it split a word later.
  }
  return out;
}

/** Drop combining marks from Latin/Arabic/etc. but keep them inside Indic blocks. */
function stripForeignMarks(text: string): string {
  let out = "";
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;
    if (/\p{M}/u.test(char) && !scriptFor(codePoint)) continue;
    out += char;
  }
  return out;
}

/** Case-, accent- and punctuation-insensitive form. Keeps the original script. */
function foldBasic(text: string): string {
  return stripForeignMarks(text.normalize("NFKD"))
    .toLowerCase()
    .replace(/[\u200c\u200d\ufeff]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Loose phonetic spelling: aspirated pairs collapse, `zh`/`sh`/`ch` become
 * sibilants, doubled letters collapse. Applied to both sides of a comparison,
 * so it never makes an exact match harder.
 */
function phonetic(text: string): string {
  return text
    .replace(/chh/g, "s")
    .replace(/ch/g, "s")
    .replace(/sh/g, "s")
    .replace(/zh/g, "l")
    .replace(/th/g, "t")
    .replace(/dh/g, "d")
    .replace(/ph/g, "f")
    .replace(/bh/g, "b")
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .replace(/jh/g, "j")
    .replace(/rh/g, "r")
    .replace(/([a-z])\1+/g, "$1");
}

export interface SearchKey {
  /** Matches the text in its own script. */
  basic: string;
  /** Matches across scripts and informal spellings. */
  phonetic: string;
}

export function buildSearchKey(raw: string): SearchKey {
  const lowered = raw.toLowerCase();
  return {
    basic: foldBasic(lowered),
    phonetic: phonetic(foldBasic(transliterate(lowered))),
  };
}

function isSubsequence(needle: string, haystack: string): boolean {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

/** 0 means "no match"; higher scores rank earlier. */
function matchTerm(term: string, haystack: string): number {
  if (!term || !haystack) return 0;
  const index = haystack.indexOf(term);
  if (index === 0) return 6;
  if (index > 0) return haystack[index - 1] === " " ? 5 : 4;
  if (term.length >= 3 && isSubsequence(term, haystack)) return 2;
  return 0;
}

export function scoreKey(query: SearchKey, key: SearchKey): number {
  const terms = query.basic.split(" ").filter(Boolean);
  if (terms.length === 0) return 1;
  const phoneticTerms = query.phonetic.split(" ").filter(Boolean);

  let score = 0;
  for (let i = 0; i < terms.length; i += 1) {
    const best = Math.max(
      matchTerm(terms[i], key.basic),
      matchTerm(phoneticTerms[i] ?? terms[i], key.phonetic),
    );
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

/**
 * Filter and rank items by a free-text query in any language. Every term must
 * match, so `yesu love` requires both; results are ordered by relevance while
 * keeping the original order for ties.
 */
export function rankByQuery<T>(
  items: T[],
  query: string,
  getKey: (item: T) => SearchKey,
): T[] {
  const queryKey = buildSearchKey(query);
  if (!queryKey.basic) return items;

  const ranked = items
    .map((item, index) => ({ item, index, score: scoreKey(queryKey, getKey(item)) }))
    .filter((entry) => entry.score > 0);

  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.map((entry) => entry.item);
}
