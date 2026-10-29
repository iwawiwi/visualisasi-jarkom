import { describe, expect, it } from 'vitest';
import { backoffMax, backoffWait, simulateBackoff, simulateSlotted, slottedSuccess, spaceTime } from './csma';

describe('Slotted ALOHA', () => {
  it('efisiensi: N = 10, p = 0,1 → 0,3874; maksimum di p = 1/N, dan menuju 1/e', () => {
    expect(slottedSuccess(10, 0.1)).toBeCloseTo(0.3874, 4);
    for (const p of [0.05, 0.15, 0.3]) expect(slottedSuccess(10, p)).toBeLessThan(slottedSuccess(10, 0.1));
    expect(slottedSuccess(1000, 1 / 1000)).toBeCloseTo(1 / Math.E, 2);
  });

  it('simulasi ber-seed: deterministik dan mendekati teori', () => {
    const a = simulateSlotted(10, 0.1, 20000, 3);
    expect(simulateSlotted(10, 0.1, 20000, 3).efficiency).toBe(a.efficiency);
    expect(a.efficiency).toBeCloseTo(slottedSuccess(10, 0.1), 1);
    expect(a.slots.every((s) => (s.outcome === 'success') === (s.senders.length === 1))).toBe(true);
  });
});

describe('Exponential backoff', () => {
  it('rentang K = 2^min(n,10) − 1 dan waktu tunggu K × 512 bit-time', () => {
    expect([1, 2, 3, 4, 10, 11, 16].map(backoffMax)).toEqual([1, 3, 7, 15, 1023, 1023, 1023]);
    expect(backoffWait(3)).toBe(1536);
  });

  it('dua stasiun: rata-rata tabrakan ≈ 1,64 (1 + 1/2 + 1/8 + 1/64 + …)', () => {
    let total = 0;
    const runs = 20000;
    for (let s = 1; s <= runs; s++) {
      const r = simulateBackoff(2, s);
      total += 1 + r.rounds.filter((x) => !x.resolved).length;
    }
    expect(total / runs).toBeCloseTo(1.6416, 1);
  });

  it('selalu ada pemenang yang unik dan putaran terakhir terselesaikan', () => {
    for (let s = 1; s <= 500; s++) {
      for (const n of [2, 3, 4]) {
        const r = simulateBackoff(n, s);
        expect(r.gaveUp).toBe(false);
        const last = r.rounds.at(-1)!;
        expect(last.resolved && last.winners).toEqual([r.winner]);
        expect(r.rounds.slice(0, -1).every((x) => !x.resolved && x.winners.length >= 2)).toBe(true);
        for (const x of r.rounds) expect(x.picks.every((p) => p.k <= backoffMax(x.n))).toBe(true);
      }
    }
  });
});

describe('Diagram ruang-waktu', () => {
  it('mulai bersamaan (d = 4): bertemu di tengah pada t = 2, keduanya mendeteksi pada t = 4', () => {
    const s = spaceTime({ d: 4, tA: 0, tB: 0, frame: 10 });
    expect([s.collision, s.meetT, s.meetX, s.aDetects, s.bDetects]).toEqual([true, 2, 2, 4, 4]);
  });

  it('kasus terburuk: B mulai hampir tepat sebelum sinyal A tiba, A baru tahu pada ≈ 2d', () => {
    const s = spaceTime({ d: 4, tA: 0, tB: 3.9, frame: 8 });
    expect(s.aDetects).toBeCloseTo(7.9, 6);
    expect(s.aSees).toBe(true); // frame 8 = 2d masih cukup
    expect(spaceTime({ d: 4, tA: 0, tB: 3.9, frame: 6 }).aSees).toBe(false); // frame < 2d: tabrakan tak terlihat
    expect(s.minFrame).toBe(8);
  });

  it('B yang mulai setelah sinyal A tiba mendengar kanal sibuk: tidak ada tabrakan', () => {
    expect(spaceTime({ d: 4, tA: 0, tB: 4, frame: 8 }).collision).toBe(false);
  });
});
