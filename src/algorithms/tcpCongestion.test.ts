import { describe, expect, it } from 'vitest';
import { type CcOptions, type LossKind, bottleneck, estimateRtt, initialCc, runCc, simulateFairness, totalSegments } from './tcpCongestion';
import { makeRng } from '../core/rng';

const cw = (o: CcOptions) => runCc(o).map((r) => r.cwnd);

describe('Slow start dan congestion avoidance', () => {
  it('ssthresh 16 tanpa loss: 1,2,4,8,16 lalu naik 1 per RTT', () => {
    const r = runCc({ variant: 'reno', ssthresh: 16, rounds: 9 });
    expect(r.map((x) => x.cwnd)).toEqual([1, 2, 4, 8, 16, 17, 18, 19, 20]);
    expect(r.map((x) => x.phase)).toEqual(['ss', 'ss', 'ss', 'ss', 'ca', 'ca', 'ca', 'ca', 'ca']);
  });

  it('slow start dipotong di ssthresh yang bukan pangkat dua', () => {
    expect(cw({ variant: 'reno', ssthresh: 10, rounds: 7 })).toEqual([1, 2, 4, 8, 10, 11, 12]);
  });
});

describe('Reaksi terhadap loss', () => {
  const at8 = (loss: LossKind) => ({ 8: loss }) as Record<number, LossKind>;

  it('Reno + 3 dup ACK di cwnd 20: ssthresh = 10, cwnd = 10, lanjut linear', () => {
    const r = runCc({ variant: 'reno', ssthresh: 16, rounds: 12, losses: at8('3dup') });
    expect(r.map((x) => x.cwnd).slice(8)).toEqual([20, 10, 11, 12]);
    expect(r[9].ssthresh).toBe(10);
    expect(r[9].phase).toBe('ca');
  });

  it('Tahoe + 3 dup ACK: cwnd kembali 1, slow start sampai ssthresh 10 lalu linear', () => {
    const r = runCc({ variant: 'tahoe', ssthresh: 16, rounds: 15, losses: at8('3dup') });
    expect(r.map((x) => x.cwnd).slice(8)).toEqual([20, 1, 2, 4, 8, 10, 11]);
    expect(r[9].phase).toBe('ss');
  });

  it('timeout: sama untuk Tahoe dan Reno (kembali ke 1)', () => {
    const a = cw({ variant: 'tahoe', ssthresh: 16, rounds: 14, losses: at8('timeout') });
    const b = cw({ variant: 'reno', ssthresh: 16, rounds: 14, losses: at8('timeout') });
    expect(a).toEqual(b);
    expect(a[9]).toBe(1);
  });

  it('Reno mengirim lebih banyak segmen daripada Tahoe pada 3 dup ACK yang sama', () => {
    const o = { ssthresh: 16, rounds: 20, losses: { 8: '3dup' as const } };
    expect(totalSegments(runCc({ variant: 'reno', ...o }))).toBeGreaterThan(totalSegments(runCc({ variant: 'tahoe', ...o })));
  });

  it('ssthresh tidak pernah kurang dari 2, bahkan saat cwnd kecil', () => {
    const r = runCc({ variant: 'reno', ssthresh: 16, rounds: 4, losses: { 0: 'timeout', 1: 'timeout' } });
    expect(r[2].ssthresh).toBe(2);
  });

  it('properti acak: cwnd ≥ 1, ssthresh ≥ 2, dan tiap loss memotong ssthresh jadi setengah cwnd', () => {
    const rng = makeRng(5);
    for (let t = 0; t < 300; t++) {
      const losses: Record<number, LossKind> = {};
      for (let r = 0; r < 30; r++) if (rng.chance(0.15)) losses[r] = rng.chance(0.5) ? '3dup' : 'timeout';
      for (const variant of ['tahoe', 'reno'] as const) {
        const rs = runCc({ variant, ssthresh: 2 + rng.int(30), rounds: 30, losses });
        for (const r of rs) {
          expect(r.cwnd).toBeGreaterThanOrEqual(1);
          expect(r.ssthresh).toBeGreaterThanOrEqual(2);
          if (r.loss) expect(r.after.ssthresh).toBe(Math.max(Math.floor(r.cwnd / 2), 2));
          if (r.phase === 'ca' && !r.loss) expect(r.after.cwnd).toBe(r.cwnd + 1);
        }
      }
    }
  });

  it('3 ACK ganda saat cwnd < 4 tidak mungkin: yang terjadi timeout (cwnd 1, ssthresh ≥ 2)', () => {
    const r = runCc({ variant: 'reno', ssthresh: 16, rounds: 4, losses: { 1: '3dup' } });
    expect(r[1].cwnd).toBe(2);
    expect(r[1].loss).toBe('timeout');
    expect(r[2]).toMatchObject({ cwnd: 1, ssthresh: 2, phase: 'ss' });
    expect(r[1].text).toContain('timeout');
  });

  it('batas bawah ssthresh = 2 ditampilkan eksplisit di teks', () => {
    const r = runCc({ variant: 'reno', ssthresh: 16, rounds: 2, losses: { 0: 'timeout' } });
    expect(r[0].text).toContain('\\max(');
  });

  it('initialCc memulai dari 1 MSS di slow start', () => {
    expect(initialCc(8)).toEqual({ cwnd: 1, ssthresh: 8, phase: 'ss' });
  });
});

describe('Keadilan AIMD vs AIAD', () => {
  it('AIMD: selisih kedua aliran menyusut menuju nol; AIAD: selisih tidak berkurang', () => {
    const aimd = simulateFairness(40, 6, 60, 'aimd', 200);
    const aiad = simulateFairness(40, 6, 60, 'aiad', 200);
    const gap = (p: { x1: number; x2: number }) => Math.abs(p.x1 - p.x2);
    expect(gap(aimd.at(-1)!)).toBeLessThan(gap(aimd[0]) / 4);
    expect(gap(aiad.at(-1)!)).toBeGreaterThanOrEqual(gap(aiad[0]) - 1e-9);
  });

  it('jumlah aliran tidak pernah turun di bawah 1 dan bergoyang di sekitar kapasitas', () => {
    const pts = simulateFairness(10, 10, 50, 'aimd', 100);
    expect(pts.every((p) => p.x1 >= 1 && p.x2 >= 1)).toBe(true);
    expect(Math.max(...pts.map((p) => p.x1 + p.x2))).toBeLessThanOrEqual(50 + 2);
  });
});

describe('Estimasi RTT', () => {
  it('sampel pertama menginisialisasi; lonjakan menaikkan timeout lebih dari estimasi', () => {
    const pts = estimateRtt([100, 100, 100, 100, 400, 100]);
    expect(pts[0]).toMatchObject({ est: 100, dev: 50, timeout: 300 });
    expect(pts[3].dev).toBeLessThan(pts[0].dev);
    const spike = pts[4];
    expect(spike.est).toBeCloseTo(0.875 * pts[3].est + 0.125 * 400, 6);
    expect(spike.timeout - spike.est).toBeGreaterThan(pts[3].timeout - pts[3].est);
  });

  it('urutan RFC 6298: DevRTT memakai EstimatedRTT sebelum diperbarui ([100, 300] → Dev = 87,5, Est = 125)', () => {
    const [, p] = estimateRtt([100, 300]);
    expect(p.dev).toBeCloseTo(0.75 * 50 + 0.25 * 200, 9);
    expect(p.est).toBeCloseTo(0.875 * 100 + 0.125 * 300, 9);
    expect(p.timeout).toBeCloseTo(125 + 4 * 87.5, 9);
  });

  it('TimeoutInterval = EstimatedRTT + 4 × DevRTT', () => {
    for (const p of estimateRtt([80, 120, 95, 300, 90])) expect(p.timeout).toBeCloseTo(p.est + 4 * p.dev, 9);
  });
});

describe('Flow control vs congestion control', () => {
  it('penerima lambat → flow control; link sempit → congestion control', () => {
    expect(bottleneck(5, 10, 10)).toBe('ok');
    expect(bottleneck(8, 5, 10)).toBe('receiver');
    expect(bottleneck(8, 10, 5)).toBe('network');
    expect(bottleneck(12, 10, 10)).toBe('both');
    expect(bottleneck(20, 5, 10)).toBe('receiver');
  });
});
