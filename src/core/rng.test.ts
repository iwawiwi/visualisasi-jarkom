import { describe, expect, it } from 'vitest';
import { makeRng } from './rng';

describe('makeRng', () => {
  it('menghasilkan urutan yang sama untuk seed yang sama', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('seed berbeda menghasilkan urutan berbeda', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('int() selalu berada dalam [0, n) dan chance() menghormati batas 0 dan 1', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });
});
