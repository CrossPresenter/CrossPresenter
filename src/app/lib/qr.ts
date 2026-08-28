// Minimal QR code generator (byte mode, error correction level M, versions 1-6).
// No dependencies; produces a matrix of boolean modules (true = dark) plus an SVG renderer.

const GF_EXP = new Int32Array(512);
const GF_LOG = new Int32Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function generatorPoly(degree: number) {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gfMul(g[j], GF_EXP[i]);
    }
    g = next;
  }
  return g;
}

function rsEncode(data: number[], ecLen: number) {
  const gen = generatorPoly(ecLen);
  const res = new Array(data.length + ecLen).fill(0);
  data.forEach((b, i) => (res[i] = b));
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// Version -> [totalCodewords, ecCodewordsPerBlock, blockDataCodewords[]] for EC level M
const VERSION_INFO: Record<number, { total: number; ec: number; blocks: number[] }> = {
  1: { total: 26, ec: 10, blocks: [16] },
  2: { total: 44, ec: 16, blocks: [28] },
  3: { total: 70, ec: 26, blocks: [44] },
  4: { total: 100, ec: 18, blocks: [32, 32] },
  5: { total: 134, ec: 24, blocks: [43, 43] },
  6: { total: 172, ec: 16, blocks: [27, 27, 27, 27] },
};

const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
};

// EC level M format bits = 0b00 (L=01, M=00, Q=11, H=10)
const EC_LEVEL_BITS = 0b00;

// Alignment pattern centers that do not overlap finder patterns (version 1-6).
function alignmentCenters(version: number, _size: number): Array<[number, number]> {
  const pos = ALIGNMENT_POSITIONS[version];
  if (pos.length === 0) return [];
  const first = pos[0];
  const last = pos[pos.length - 1];
  const centers: Array<[number, number]> = [];
  for (const y of pos) {
    for (const x of pos) {
      if ((x === first && y === first) || (x === first && y === last) || (x === last && y === first)) continue;
      centers.push([x, y]);
    }
  }
  return centers;
}

function getFormatBits(mask: number) {
  const data = (EC_LEVEL_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function maskCondition(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return false;
  }
}

function selectVersion(dataLength: number): number {
  for (let v = 1; v <= 6; v++) {
    const capacity = VERSION_INFO[v].blocks.reduce((a, b) => a + b, 0);
    // 4 bits mode + 8 bits length + data
    if (4 + 8 + dataLength * 8 <= capacity * 8) return v;
  }
  throw new Error("QR data too long (max ~106 bytes for version 6)");
}

function penaltyScore(modules: boolean[][], size: number): number {
  let score = 0;

  // Rule 1: runs of same color of length >= 5
  for (let y = 0; y < size; y++) {
    let run = 1;
    for (let x = 1; x < size; x++) {
      if (modules[y][x] === modules[y][x - 1]) run++;
      else { if (run >= 5) score += 3 + run - 5; run = 1; }
    }
    if (run >= 5) score += 3 + run - 5;
  }
  for (let x = 0; x < size; x++) {
    let run = 1;
    for (let y = 1; y < size; y++) {
      if (modules[y][x] === modules[y - 1][x]) run++;
      else { if (run >= 5) score += 3 + run - 5; run = 1; }
    }
    if (run >= 5) score += 3 + run - 5;
  }

  // Rule 2: 2x2 blocks of same color
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
    }
  }

  // Rule 3: 1:1:3:1:1 finder-like patterns
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const check = (seq: boolean[]) => {
    for (let s = 0; s + pattern.length <= seq.length; s++) {
      let match = true;
      for (let i = 0; i < pattern.length; i++) {
        if (seq[s + i] !== pattern[i]) { match = false; break; }
      }
      if (match) { score += 40; continue; }
      let revMatch = true;
      for (let i = 0; i < pattern.length; i++) {
        if (seq[s + i] !== pattern[pattern.length - 1 - i]) { revMatch = false; break; }
      }
      if (revMatch) score += 40;
    }
  };
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(modules[y][x]);
    check(row);
  }
  for (let x = 0; x < size; x++) {
    const col: boolean[] = [];
    for (let y = 0; y < size; y++) col.push(modules[y][x]);
    check(col);
  }

  // Rule 4: dark module proportion
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
  const percent = (dark * 100) / (size * size);
  const k = Math.abs(Math.ceil(percent / 5) - 10);
  score += k * 10;

  return score;
}

export function generateQR(text: string): boolean[][] {
  const dataBytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) throw new Error("QR byte mode only supports Latin-1 text");
    dataBytes.push(code);
  }

  const version = selectVersion(dataBytes.length);
  const info = VERSION_INFO[version];
  const totalDataCodewords = info.blocks.reduce((a, b) => a + b, 0);

  // Build bit stream: mode(0100) + length(8 bits) + data
  const bits: number[] = [];
  const pushBits = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  pushBits(0b0100, 4);
  pushBits(dataBytes.length, 8);
  for (const b of dataBytes) pushBits(b, 8);

  // Terminator (up to 4 zero bits) + pad to byte boundary
  const capacityBits = totalDataCodewords * 8;
  const terminator = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < terminator; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes
  const padBytes = [0xec, 0x11];
  let p = 0;
  while (bits.length < capacityBits) {
    for (let i = 7; i >= 0; i--) bits.push((padBytes[p] >> i) & 1);
    p = (p + 1) % 2;
  }

  // Group into codewords
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }

  // Split into blocks and compute EC
  const ecPerBlock = info.ec;
  const blocksData: number[][] = [];
  let offset = 0;
  for (const size of info.blocks) {
    blocksData.push(codewords.slice(offset, offset + size));
    offset += size;
  }

  const ecBlocks = blocksData.map(block => rsEncode(block, ecPerBlock));

  // Interleave data codewords
  const interleaved: number[] = [];
  const maxDataLen = Math.max(...info.blocks);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of blocksData) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) interleaved.push(block[i]);
  }

  const size = 17 + 4 * version;

  const buildMatrix = (mask: number): boolean[][] => {
    const m: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

    const set = (x: number, y: number, v: boolean) => {
      if (x >= 0 && x < size && y >= 0 && y < size) m[y][x] = v;
    };

    // Finder patterns
    const drawFinder = (cx: number, cy: number) => {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          // Outer border (dist 3) and inner 3x3 (dist <= 1) are dark; ring (dist 2) is light
          const dark = dist !== 2;
          set(cx + dx, cy + dy, dark);
        }
      }
    };
    drawFinder(3, 3);
    drawFinder(size - 4, 3);
    drawFinder(3, size - 4);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      const v = i % 2 === 0;
      m[6][i] = v;
      m[i][6] = v;
    }

    // Dark module
    m[size - 8][8] = true;

    // Alignment patterns
    for (const [ax, ay] of alignmentCenters(version, size)) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          set(ax + dx, ay + dy, dist !== 1);
        }
      }
    }

    // Format info
    const fmt = getFormatBits(mask);
    const fmtBits: boolean[] = [];
    for (let i = 0; i < 15; i++) fmtBits.push(((fmt >> i) & 1) === 1); // LSB-first
    // Copy 1 around top-left finder (column 8 / row 8)
    for (let i = 0; i <= 5; i++) set(8, i, fmtBits[i]);          // rows 0..5, col 8
    set(8, 7, fmtBits[6]);                                        // row 7, col 8
    set(8, 8, fmtBits[7]);                                        // row 8, col 8
    set(7, 8, fmtBits[8]);                                        // row 8, col 7
    for (let i = 9; i < 15; i++) set(14 - i, 8, fmtBits[i]);      // row 8, cols 5..0
    // Copy 2 horizontal (row 8, cols size-1..size-8)
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, fmtBits[i]);
    // Copy 2 vertical (col 8, rows size-7..size-1)
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, fmtBits[i]);
    // Dark module
    set(8, size - 8, true);

    // Data placement
    let dataIndex = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let i = 0; i < size; i++) {
        const y = upward ? size - 1 - i : i;
        for (let j = 0; j < 2; j++) {
          const x = col - j;
          if (isReserved(x, y)) continue;
          if (dataIndex >= interleaved.length * 8) break;
          const bit = (interleaved[dataIndex >> 3] >> (7 - (dataIndex & 7))) & 1;
          dataIndex++;
          m[y][x] = bit === 1;
        }
      }
      upward = !upward;
    }

    // Apply mask to non-function modules
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunctionModule(x, y, size)) {
          if (maskCondition(mask, x, y)) m[y][x] = !m[y][x];
        }
      }
    }

    return m;
  };

  // Reserved function modules (finder/timing/alignment/format/version areas)
  const isFunctionModule = (x: number, y: number, s: number): boolean => {
    // Finder + separator areas (3x3 + 1 margin around each finder)
    if (x <= 8 && y <= 8) return true;
    if (x >= s - 8 && y <= 8) return true;
    if (x <= 8 && y >= s - 8) return true;
    // Timing
    if (x === 6 || y === 6) return true;
    // Alignment patterns
    for (const [ax, ay] of alignmentCenters(version, size)) {
      if (Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2) return true;
    }
    return false;
  };

  // isReserved for data placement
  const isReserved = (x: number, y: number): boolean => isFunctionModule(x, y, size);

  // Try all masks, pick lowest penalty
  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = buildMatrix(mask);
    const score = penaltyScore(candidate, size);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best!;
}

export function qrToSvg(text: string, size = 200): string {
  const matrix = generateQR(text);
  const n = matrix.length;
  const cells = n + 8;
  const cellSize = Math.floor(size / cells);
  const quiet = cellSize * 4;
  const dim = cells * cellSize;

  const rects: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) {
        rects.push(`<rect x="${quiet + x * cellSize}" y="${quiet + y * cellSize}" width="${cellSize}" height="${cellSize}"/>`);
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects.join("")}</g>` +
    `</svg>`
  );
}
