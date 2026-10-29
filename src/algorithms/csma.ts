import { makeRng } from '../core/rng';

/* ---------- Slotted ALOHA ---------- */

/** Peluang sebuah slot sukses: tepat satu dari N stasiun mengirim (masing-masing dengan peluang p). */
export const slottedSuccess = (n: number, p: number): number => n * p * (1 - p) ** (n - 1);

export type SlotOutcome = 'empty' | 'success' | 'collision';

export interface SlotResult {
  slot: number;
  senders: number[];
  outcome: SlotOutcome;
}

export function simulateSlotted(n: number, p: number, slots: number, seed: number): { slots: SlotResult[]; efficiency: number } {
  const rng = makeRng(seed);
  const out: SlotResult[] = [];
  for (let slot = 0; slot < slots; slot++) {
    const senders = Array.from({ length: n }, (_, i) => i).filter(() => rng.chance(p));
    out.push({ slot, senders, outcome: senders.length === 0 ? 'empty' : senders.length === 1 ? 'success' : 'collision' });
  }
  return { slots: out, efficiency: out.filter((s) => s.outcome === 'success').length / Math.max(1, slots) };
}

/* ---------- Exponential backoff (CSMA/CD) ---------- */

/** Setelah tabrakan ke-n, K dipilih acak dari {0, …, 2^min(n,10) − 1}. */
export const backoffMax = (n: number): number => 2 ** Math.min(n, 10) - 1;

/** Waktu tunggu dalam bit-time: K × 512. */
export const backoffWait = (k: number): number => k * 512;

export interface BackoffRound {
  /** Tabrakan ke-n yang baru terjadi. */
  n: number;
  /** Stasiun yang masih berebut pada putaran ini beserta nilai K yang mereka pilih. */
  picks: { station: number; k: number }[];
  /** Stasiun dengan K terkecil; unik berarti menang. */
  min: number;
  winners: number[];
  resolved: boolean;
}

export interface BackoffResult {
  rounds: BackoffRound[];
  winner?: number;
  /** Menyerah setelah 16 percobaan. */
  gaveUp: boolean;
}

/**
 * Stasiun-stasiun yang tabrakan memilih K masing-masing. Yang K-nya terkecil dan unik mengirim lebih dulu;
 * bila terkecil itu seri, hanya yang seri bertabrakan lagi (yang lain menunggu giliran).
 */
export function simulateBackoff(stations: number, seed: number, maxAttempts = 16): BackoffResult {
  const rng = makeRng(seed);
  let contenders = Array.from({ length: stations }, (_, i) => i);
  const rounds: BackoffRound[] = [];
  for (let n = 1; n < maxAttempts; n++) {
    const picks = contenders.map((station) => ({ station, k: rng.int(backoffMax(n) + 1) }));
    const min = Math.min(...picks.map((x) => x.k));
    const winners = picks.filter((x) => x.k === min).map((x) => x.station);
    const resolved = winners.length === 1;
    rounds.push({ n, picks, min, winners, resolved });
    if (resolved) return { rounds, winner: winners[0], gaveUp: false };
    contenders = winners;
  }
  return { rounds, gaveUp: true };
}

/* ---------- Diagram ruang-waktu ---------- */

export interface SpaceTimeInput {
  /** Waktu rambat A↔B. */
  d: number;
  /** Saat A dan B mulai mengirim (tA ≤ tB). */
  tA: number;
  tB: number;
  /** Lama pengiriman frame. */
  frame: number;
}

export interface SpaceTime {
  /** B mengirim sebelum sinyal A sampai (B mendengar kanal masih sepi): terjadi tabrakan. */
  collision: boolean;
  /** Titik pertemuan sinyal: waktu dan posisi (0 = A, d = B). */
  meetT: number;
  meetX: number;
  /** Saat A dan B mendeteksi tabrakan. */
  aDetects: number;
  bDetects: number;
  /** A masih mengirim ketika tabrakan sampai ke A (jadi terdeteksi). */
  aSees: boolean;
  bSees: boolean;
  /** Panjang frame minimum agar tabrakan terburuk tetap terdeteksi: 2d. */
  minFrame: number;
}

export function spaceTime({ d, tA, tB, frame }: SpaceTimeInput): SpaceTime {
  const collision = tB < tA + d;
  const aDetects = tB + d;
  const bDetects = tA + d;
  return {
    collision,
    meetT: (d + tA + tB) / 2,
    meetX: (d + tB - tA) / 2,
    aDetects,
    bDetects,
    aSees: collision && aDetects <= tA + frame,
    bSees: collision && bDetects <= tB + frame,
    minFrame: 2 * d,
  };
}
