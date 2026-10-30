// Generates the CrossPresenter source logo as a 1024x1024 PNG using only Node
// built-ins, so the icon pipeline has no image-library dependency.
//
//   node scripts/gen-logo.mjs assets/logo.png
//
// Feed the result to `npx tauri icon` to produce the platform icon set.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SIZE = 1024;

// --- palette ---------------------------------------------------------------
const BG_TOP = [17, 24, 39]; // slate-900
const BG_BOTTOM = [30, 41, 59]; // slate-800
const CROSS = [248, 250, 252]; // slate-50
const ACCENT = [220, 38, 38]; // red-600

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [
  Math.round(lerp(c1[0], c2[0], t)),
  Math.round(lerp(c1[1], c2[1], t)),
  Math.round(lerp(c1[2], c2[2], t)),
];

/** Signed-distance helper for a rounded rectangle, used for anti-aliasing. */
function roundedRectAlpha(px, py, x, y, w, h, r) {
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.hypot(dx, dy);
  // 1px feather band gives clean edges at every downscaled size.
  return Math.max(0, Math.min(1, r - dist + 0.5));
}

const rgba = Buffer.alloc(SIZE * SIZE * 4);

// Cross geometry: a vertical bar and a horizontal bar, both rounded.
const barW = SIZE * 0.155;
const vX = (SIZE - barW) / 2;
const vY = SIZE * 0.17;
const vH = SIZE * 0.66;
const hW = SIZE * 0.52;
const hX = (SIZE - hW) / 2;
const hY = SIZE * 0.345;
const radius = barW / 2;

// Accent underline evoking the projected output line.
const uW = SIZE * 0.30;
const uH = SIZE * 0.042;
const uX = (SIZE - uW) / 2;
const uY = SIZE * 0.80;

for (let y = 0; y < SIZE; y++) {
  const base = mix(BG_TOP, BG_BOTTOM, y / (SIZE - 1));
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;

    // Rounded app-icon mask.
    const outer = roundedRectAlpha(x + 0.5, y + 0.5, 0, 0, SIZE, SIZE, SIZE * 0.22);

    let r = base[0];
    let g = base[1];
    let b = base[2];

    // Subtle radial lift so the mark reads on dark and light docks alike.
    const dcx = (x - SIZE / 2) / SIZE;
    const dcy = (y - SIZE / 2) / SIZE;
    const glow = Math.max(0, 0.22 - Math.hypot(dcx, dcy) * 0.42);
    r = Math.min(255, r + glow * 120);
    g = Math.min(255, g + glow * 130);
    b = Math.min(255, b + glow * 150);

    const crossA = Math.max(
      roundedRectAlpha(x + 0.5, y + 0.5, vX, vY, barW, vH, radius),
      roundedRectAlpha(x + 0.5, y + 0.5, hX, hY, hW, barW, radius),
    );
    if (crossA > 0) {
      r = lerp(r, CROSS[0], crossA);
      g = lerp(g, CROSS[1], crossA);
      b = lerp(b, CROSS[2], crossA);
    }

    const underA = roundedRectAlpha(x + 0.5, y + 0.5, uX, uY, uW, uH, uH / 2);
    if (underA > 0) {
      r = lerp(r, ACCENT[0], underA);
      g = lerp(g, ACCENT[1], underA);
      b = lerp(b, ACCENT[2], underA);
    }

    rgba[i] = Math.round(r);
    rgba[i + 1] = Math.round(g);
    rgba[i + 2] = Math.round(b);
    rgba[i + 3] = Math.round(outer * 255);
  }
}

// --- PNG container ---------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
ihdr[10] = 0; // deflate
ihdr[11] = 0; // adaptive filtering
ihdr[12] = 0; // no interlace

// Each scanline is prefixed with its filter byte (0 = none).
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const src = y * SIZE * 4;
  const dst = y * (SIZE * 4 + 1);
  raw[dst] = 0;
  rgba.copy(raw, dst + 1, src, src + SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = process.argv[2] ?? "assets/logo.png";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`wrote ${out} (${SIZE}x${SIZE}, ${png.length} bytes)`);
