/**
 * Model kontrol kongesti TCP per RTT (satuan: MSS). Sederhana namun setia pada buku Kurose & Ross:
 * slow start menggandakan cwnd tiap RTT sampai ssthresh, lalu congestion avoidance menambah 1 MSS per RTT.
 */

export type Variant = 'tahoe' | 'reno';
export type Phase = 'ss' | 'ca';
export type LossKind = '3dup' | 'timeout';

export interface CcState {
  cwnd: number;
  ssthresh: number;
  phase: Phase;
}

export interface CcRound {
  /** Nomor RTT (mulai 0). Pada RTT ini pengirim mengirim `cwnd` segmen. */
  round: number;
  cwnd: number;
  ssthresh: number;
  phase: Phase;
  /** Kehilangan yang terdeteksi pada akhir RTT ini. */
  loss?: LossKind;
  /** Keadaan setelah reaksi/pertumbuhan, yaitu awal RTT berikutnya. */
  after: CcState;
  text: string;
}

const halve = (cwnd: number) => Math.max(Math.floor(cwnd / 2), 2);

/** Tiga ACK ganda butuh minimal 4 segmen di jalan; dengan cwnd lebih kecil yang terjadi adalah timeout. */
const effectiveLoss = (cwnd: number, loss?: LossKind): LossKind | undefined => (loss === '3dup' && cwnd < 4 ? 'timeout' : loss);

/** Satu transisi per RTT: tumbuh, atau bereaksi terhadap kehilangan. */
export function ccStep(s: CcState, variant: Variant, rawLoss?: LossKind): CcState {
  const loss = effectiveLoss(s.cwnd, rawLoss);
  if (loss) {
    const ssthresh = halve(s.cwnd);
    // Reno: 3 dup ACK tidak mengulang dari 1 (fast recovery); Tahoe dan semua timeout kembali ke slow start.
    if (loss === '3dup' && variant === 'reno') return { cwnd: ssthresh, ssthresh, phase: 'ca' };
    return { cwnd: 1, ssthresh, phase: 'ss' };
  }
  if (s.phase === 'ss') {
    const cwnd = Math.min(s.cwnd * 2, s.ssthresh);
    return { cwnd, ssthresh: s.ssthresh, phase: cwnd >= s.ssthresh ? 'ca' : 'ss' };
  }
  return { ...s, cwnd: s.cwnd + 1 };
}

export const initialCc = (ssthresh: number): CcState => ({ cwnd: 1, ssthresh, phase: ssthresh <= 1 ? 'ca' : 'ss' });

/** ssthresh = ⌊cwnd/2⌋, tetapi tidak kurang dari 2 (tampilkan max bila batas bawah itu berlaku). */
const halfTex = (cwnd: number, result: number): string => (Math.floor(cwnd / 2) < 2 ? `\\max(\\lfloor ${cwnd}/2\\rfloor,2)=${result}` : `\\lfloor ${cwnd}/2\\rfloor=${result}`);

function describe(s: CcState, after: CcState, variant: Variant, loss?: LossKind, requested?: LossKind): string {
  if (loss === 'timeout')
    return `${requested === '3dup' ? `Hanya $${s.cwnd}$ segmen di jalan: tidak cukup untuk 3 ACK ganda, jadi pengirim menunggu timeout. ` : ''}Timeout! $\\mathrm{ssthresh}=${halfTex(s.cwnd, after.ssthresh)}$, $\\mathrm{cwnd}$ kembali ke $1$ dan masuk slow start.`;
  if (loss === '3dup')
    return variant === 'reno'
      ? `3 ACK ganda. Reno: $\\mathrm{ssthresh}=${halfTex(s.cwnd, after.ssthresh)}$ dan $\\mathrm{cwnd}=${after.cwnd}$, langsung congestion avoidance.`
      : `3 ACK ganda. Tahoe: $\\mathrm{ssthresh}=${halfTex(s.cwnd, after.ssthresh)}$ tetapi $\\mathrm{cwnd}$ kembali ke $1$ (slow start).`;
  if (s.phase === 'ss')
    return after.cwnd >= s.ssthresh
      ? `Slow start: $\\mathrm{cwnd}$ berlipat ganda sampai menyentuh $\\mathrm{ssthresh}=${s.ssthresh}$, lalu beralih ke congestion avoidance.`
      : `Slow start: tiap ACK menambah $1$ MSS, jadi $\\mathrm{cwnd}$ berlipat ganda ($${s.cwnd}\\to ${after.cwnd}$).`;
  return `Congestion avoidance: $\\mathrm{cwnd}$ naik $1$ MSS per RTT ($${s.cwnd}\\to ${after.cwnd}$).`;
}

export interface CcOptions {
  variant: Variant;
  ssthresh: number;
  /** Jumlah RTT yang disimulasikan. */
  rounds: number;
  /** Kehilangan per nomor RTT. */
  losses?: Record<number, LossKind>;
}

export function runCc({ variant, ssthresh, rounds, losses = {} }: CcOptions): CcRound[] {
  const out: CcRound[] = [];
  let s = initialCc(ssthresh);
  for (let r = 0; r < rounds; r++) {
    const requested = losses[r];
    const loss = effectiveLoss(s.cwnd, requested);
    const after = ccStep(s, variant, requested);
    out.push({ round: r, cwnd: s.cwnd, ssthresh: s.ssthresh, phase: s.phase, loss, after, text: `RTT ${r}: kirim $${s.cwnd}$ segmen. ${describe(s, after, variant, loss, requested)}` });
    s = after;
  }
  return out;
}

/** Total segmen yang terkirim selama seluruh RTT (jumlah cwnd tiap RTT). */
export const totalSegments = (rs: CcRound[]) => rs.reduce((sum, r) => sum + r.cwnd, 0);

/* ---------- Keadilan dua aliran (AIMD vs AIAD) ---------- */

export type FairMode = 'aimd' | 'aiad';

export interface FairPoint {
  x1: number;
  x2: number;
}

/**
 * Dua aliran berbagi satu link berkapasitas `capacity`. Selama jumlah < kapasitas, keduanya menambah 1;
 * saat melebihi kapasitas keduanya berkurang: AIMD dibagi dua, AIAD dikurangi `step` tetap.
 */
export function simulateFairness(x1: number, x2: number, capacity: number, mode: FairMode, rounds: number, step = 4): FairPoint[] {
  const pts: FairPoint[] = [{ x1, x2 }];
  let a = x1;
  let b = x2;
  for (let i = 0; i < rounds; i++) {
    if (a + b > capacity) {
      if (mode === 'aimd') {
        a = Math.max(1, a / 2);
        b = Math.max(1, b / 2);
      } else {
        a = Math.max(1, a - step);
        b = Math.max(1, b - step);
      }
    } else {
      a += 1;
      b += 1;
    }
    pts.push({ x1: a, x2: b });
  }
  return pts;
}

/* ---------- Estimasi RTT dan timeout ---------- */

export interface RttPoint {
  sample: number;
  est: number;
  dev: number;
  timeout: number;
}

/**
 * EstimatedRTT = (1 − α)·EstimatedRTT + α·SampleRTT dan DevRTT = (1 − β)·DevRTT + β·|SampleRTT − EstimatedRTT|
 * (DevRTT memakai EstimatedRTT sebelum diperbarui, urutan RFC 6298). TimeoutInterval = EstimatedRTT + 4·DevRTT.
 */
export function estimateRtt(samples: number[], alpha = 0.125, beta = 0.25): RttPoint[] {
  const out: RttPoint[] = [];
  let est = 0;
  let dev = 0;
  samples.forEach((sample, i) => {
    if (i === 0) {
      est = sample;
      dev = sample / 2;
    } else {
      dev = (1 - beta) * dev + beta * Math.abs(sample - est);
      est = (1 - alpha) * est + alpha * sample;
    }
    out.push({ sample, est, dev, timeout: est + 4 * dev });
  });
  return out;
}

/* ---------- Penghambat: flow control vs congestion control ---------- */

export type Bottleneck = 'ok' | 'receiver' | 'network' | 'both';

/** Kecepatan kirim lebih besar dari kemampuan penerima (flow control) atau kapasitas jaringan (congestion control). */
export function bottleneck(sendRate: number, receiverRate: number, linkRate: number): Bottleneck {
  if (sendRate <= Math.min(receiverRate, linkRate)) return 'ok';
  // Yang lebih sempit menjadi penghambat utama; sama sempit berarti keduanya.
  if (receiverRate === linkRate) return 'both';
  return receiverRate < linkRate ? 'receiver' : 'network';
}
