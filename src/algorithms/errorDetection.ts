/** Deteksi kesalahan: parity (1D dan 2D), CRC, dan checksum Internet. Semua murni dan diuji. */

export const bitsOf = (s: string): number[] => [...s].map(Number);
export const bitString = (b: number[]): string => b.join('');

/** Bit parity genap: 1 bila jumlah bit 1 ganjil, sehingga total bit 1 (termasuk parity) genap. */
export const evenParityBit = (bits: number[]): number => bits.reduce((a, b) => a ^ b, 0);

/* ---------- Parity dua dimensi ---------- */

export interface Parity2D {
  rowParity: number[];
  colParity: number[];
  corner: number;
}

export function parity2D(rows: number[][]): Parity2D {
  const rowParity = rows.map(evenParityBit);
  const colParity = rows[0].map((_, c) => evenParityBit(rows.map((r) => r[c])));
  return { rowParity, colParity, corner: evenParityBit(rowParity) };
}

/** Kisi lengkap (data + kolom parity + baris parity + sudut) dari matriks data. */
export function buildGrid2D(rows: number[][]): number[][] {
  const p = parity2D(rows);
  return [...rows.map((r, i) => [...r, p.rowParity[i]]), [...p.colParity, p.corner]];
}

export interface Check2D {
  badRows: number[];
  badCols: number[];
  /** Ada kesalahan terdeteksi. */
  detected: boolean;
  /**
   * Pola kerusakan yang konsisten dengan SATU bit salah (tepat satu baris dan satu kolom bermasalah).
   * Bila yang rusak sebenarnya 3 bit berbentuk L, pola ini juga muncul dan koreksi justru memperburuk.
   */
  located?: [number, number];
}

/** Periksa kisi lengkap: setiap baris dan kolom harus berparitas genap. */
export function check2D(grid: number[][]): Check2D {
  const badRows = grid.flatMap((r, i) => (evenParityBit(r) ? [i] : []));
  const badCols = grid[0].flatMap((_, c) => (evenParityBit(grid.map((r) => r[c])) ? [c] : []));
  const detected = badRows.length + badCols.length > 0;
  const located: [number, number] | undefined = badRows.length === 1 && badCols.length === 1 ? [badRows[0], badCols[0]] : undefined;
  return { badRows, badCols, detected, located };
}

/* ---------- CRC ---------- */

export interface CrcStep {
  /** Posisi bit depan yang dieliminasi pada langkah ini. */
  pos: number;
  /** Seluruh string sebelum dan sesudah XOR dengan generator pada posisi `pos`. */
  before: string;
  after: string;
}

export interface CrcResult {
  remainder: string;
  frame: string;
  steps: CrcStep[];
}

/** Pembagian modulo-2: sisa dari `bits` dibagi `gen`, dengan jejak langkah XOR. */
export function mod2Divide(bits: string, gen: string): { remainder: string; steps: CrcStep[] } {
  const r = gen.length - 1;
  const cur = bitsOf(bits);
  const g = bitsOf(gen);
  const steps: CrcStep[] = [];
  for (let pos = 0; pos + r < cur.length; pos++) {
    if (cur[pos] === 0) continue;
    const before = bitString(cur);
    for (let k = 0; k <= r; k++) cur[pos + k] ^= g[k];
    steps.push({ pos, before, after: bitString(cur) });
  }
  return { remainder: bitString(cur.slice(cur.length - r)), steps };
}

/** CRC pengirim: tambahkan r nol, bagi dengan generator; frame = data + sisa. */
export function crc(data: string, gen: string): CrcResult {
  const r = gen.length - 1;
  const { remainder, steps } = mod2Divide(data + '0'.repeat(r), gen);
  return { remainder, frame: data + remainder, steps };
}

/** Penerima: frame sah bila sisa pembagian oleh generator nol. */
export const crcValid = (frame: string, gen: string): boolean => /^0*$/.test(mod2Divide(frame, gen).remainder);

/* ---------- Checksum Internet (complement satu) ---------- */

export interface ChecksumStep {
  word: number;
  /** Jumlah berjalan sebelum wraparound, dan sesudahnya. */
  raw: number;
  sum: number;
  carry: boolean;
}

export interface ChecksumResult {
  steps: ChecksumStep[];
  sum: number;
  checksum: number;
}

export function checksum(words: number[], width = 16): ChecksumResult {
  const mask = 2 ** width - 1;
  let sum = 0;
  const steps: ChecksumStep[] = [];
  for (const word of words) {
    const raw = sum + word;
    const carry = raw > mask;
    sum = carry ? (raw & mask) + 1 : raw;
    steps.push({ word, raw, sum, carry });
  }
  return { steps, sum, checksum: ~sum & mask };
}

/** Penerima menjumlahkan semua kata termasuk checksum: hasil harus semua bit 1. */
export const checksumValid = (words: number[], received: number, width = 16): boolean => checksum([...words, received], width).sum === 2 ** width - 1;

/* ---------- Perbandingan teknik pada data 16 bit ---------- */

export const CRC8 = '100000111'; // x^8 + x^2 + x + 1

export interface DetectResult {
  parity: boolean;
  parity2d: boolean;
  checksum: boolean;
  crc: boolean;
}

const bytes = (bits: number[]): number[] => [parseInt(bitString(bits.slice(0, 8)), 2), parseInt(bitString(bits.slice(8, 16)), 2)];
const grid4 = (bits: number[]): number[][] => [0, 1, 2, 3].map((r) => bits.slice(r * 4, r * 4 + 4));

/** Apakah tiap teknik mendeteksi perubahan dari `original` menjadi `received` (masing-masing 16 bit)? */
export function detectAll(original: number[], received: number[]): DetectResult {
  const stored = {
    parity: evenParityBit(original),
    p2: parity2D(grid4(original)),
    sum: checksum(bytes(original), 8).checksum,
    crc: crc(bitString(original), CRC8).remainder,
  };
  const rp2 = parity2D(grid4(received));
  return {
    parity: evenParityBit(received) !== stored.parity,
    parity2d: rp2.corner !== stored.p2.corner || rp2.rowParity.some((x, i) => x !== stored.p2.rowParity[i]) || rp2.colParity.some((x, i) => x !== stored.p2.colParity[i]),
    checksum: checksum(bytes(received), 8).checksum !== stored.sum,
    crc: crc(bitString(received), CRC8).remainder !== stored.crc,
  };
}
