import { describe, expect, it } from 'vitest';
import { CRC8, bitsOf, buildGrid2D, check2D, checksum, checksumValid, crc, crcValid, detectAll, evenParityBit, parity2D } from './errorDetection';

describe('Parity', () => {
  it("huruf 'A' (1000001, dua bit 1) berparity 0; 'C' (1000011, tiga bit 1) berparity 1", () => {
    expect(evenParityBit(bitsOf('1000001'))).toBe(0);
    expect(evenParityBit(bitsOf('1000011'))).toBe(1);
    expect(evenParityBit(bitsOf('1000000'))).toBe(1);
  });

  it('parity tunggal mendeteksi jumlah error ganjil dan gagal untuk genap', () => {
    const d = bitsOf('10110010');
    const p = evenParityBit(d);
    const flip = (idx: number[]) => d.map((b, i) => (idx.includes(i) ? 1 - b : b));
    expect(evenParityBit(flip([2])) !== p).toBe(true);
    expect(evenParityBit(flip([2, 5])) !== p).toBe(false);
    expect(evenParityBit(flip([0, 3, 6])) !== p).toBe(true);
  });
});

describe('Parity dua dimensi', () => {
  const data = [bitsOf('1011'), bitsOf('0110'), bitsOf('1110'), bitsOf('0001')];
  const grid = buildGrid2D(data);

  it('kisi tanpa error sah; satu bit salah ditemukan posisinya dan bisa dikoreksi', () => {
    expect(check2D(grid).detected).toBe(false);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) {
        const bad = grid.map((row) => [...row]);
        bad[r][c] ^= 1;
        const res = check2D(bad);
        expect(res.located).toEqual([r, c]);
      }
  });

  it('dua bit salah selalu terdeteksi tetapi tidak bisa ditempatkan; empat bit di sudut persegi lolos', () => {
    const two = grid.map((row) => [...row]);
    two[0][0] ^= 1;
    two[2][3] ^= 1;
    const r2 = check2D(two);
    expect(r2.detected).toBe(true);
    expect(r2.located).toBeUndefined();
    const four = grid.map((row) => [...row]);
    for (const [r, c] of [[0, 0], [0, 2], [3, 0], [3, 2]]) four[r][c] ^= 1;
    expect(check2D(four).detected).toBe(false);
  });

  it('semua error 2 dan 3 bit pada kisi 5×5 terdeteksi; pola 3 bit berbentuk L terlihat seperti 1 bit (salah tempat)', () => {
    const cells = Array.from({ length: 25 }, (_, i) => [Math.floor(i / 5), i % 5] as const);
    const flip = (idx: number[]) => {
      const g = grid.map((row) => [...row]);
      for (const k of idx) g[cells[k][0]][cells[k][1]] ^= 1;
      return g;
    };
    let lShaped = 0;
    for (let a = 0; a < 25; a++)
      for (let b = a + 1; b < 25; b++) {
        expect(check2D(flip([a, b])).detected).toBe(true);
        for (let c = b + 1; c < 25; c++) {
          const res = check2D(flip([a, b, c]));
          expect(res.detected).toBe(true);
          if (res.located) {
            lShaped++;
            // posisi "terlokalisasi" bukan salah satu bit yang rusak
            expect([a, b, c].map((k) => cells[k].join(',')).includes(res.located.join(','))).toBe(false);
          }
        }
      }
    expect(lShaped).toBeGreaterThan(0);
  });

  it('parity sudut = parity dari parity baris', () => {
    const p = parity2D(data);
    expect(p.corner).toBe(evenParityBit(p.colParity));
  });
});

describe('CRC', () => {
  it('contoh kuliah: D = 101110, G = 1001 → R = 011, frame 101110011', () => {
    const r = crc('101110', '1001');
    expect(r.remainder).toBe('011');
    expect(r.frame).toBe('101110011');
    expect(r.steps.map((s) => s.pos)).toEqual([0, 2, 4, 5]);
    expect(r.steps.at(-1)!.after).toBe('000000011');
    expect(crcValid(r.frame, '1001')).toBe(true);
  });

  it('satu bit berubah pada frame membuat sisa tidak nol', () => {
    const f = bitsOf('101110011');
    for (let i = 0; i < f.length; i++) {
      const bad = f.map((b, k) => (k === i ? 1 - b : b)).join('');
      expect(crcValid(bad, '1001')).toBe(false);
    }
  });

  it('CRC-8 mendeteksi semua burst error sampai 8 bit (eksaustif pada frame 24 bit)', () => {
    const frame = crc('1001011010110010', CRC8).frame;
    for (let len = 1; len <= 8; len++)
      for (let start = 0; start + len <= frame.length; start++) {
        // burst: bit pertama dan terakhir salah, bit di antaranya sembarang
        const mid = len > 2 ? 2 ** (len - 2) : 1;
        for (let m = 0; m < (len > 2 ? mid : 1); m++) {
          const flips = new Set([start, start + len - 1]);
          for (let j = 0; j < len - 2; j++) if ((m >> j) & 1) flips.add(start + 1 + j);
          const bad = bitsOf(frame).map((b, i) => (flips.has(i) ? 1 - b : b)).join('');
          expect(crcValid(bad, CRC8)).toBe(false);
        }
      }
  });

  it('CRC-8 mendeteksi semua error 1, 2, dan 3 bit pada data 16 bit (eksaustif)', () => {
    const data = '1001011010110010';
    const frame = crc(data, CRC8).frame;
    expect(frame).toHaveLength(24);
    const n = frame.length;
    const flip = (idx: number[]) => bitsOf(frame).map((b, i) => (idx.includes(i) ? 1 - b : b)).join('');
    for (let a = 0; a < n; a++) {
      expect(crcValid(flip([a]), CRC8)).toBe(false);
      for (let b = a + 1; b < n; b++) {
        expect(crcValid(flip([a, b]), CRC8)).toBe(false);
        for (let c = b + 1; c < n; c++) expect(crcValid(flip([a, b, c]), CRC8)).toBe(false);
      }
    }
  });
});

describe('Checksum Internet', () => {
  const header = [0x4500, 0x0073, 0x0000, 0x4000, 0x4011, 0x0000, 0xc0a8, 0x0001, 0xc0a8, 0x00c7];

  it('header IPv4 contoh terkenal: checksum 0xB861', () => {
    const r = checksum(header);
    expect(r.checksum).toBe(0xb861);
    expect(r.steps.some((s) => s.carry)).toBe(true);
  });

  it('penerima: jumlah semua kata + checksum = 0xFFFF', () => {
    const c = checksum(header).checksum;
    expect(checksumValid(header, c)).toBe(true);
    expect(checksumValid(header, c ^ 1)).toBe(false);
  });

  it('wraparound: 0xFFFF + 0x0001 = 0x0001', () => {
    expect(checksum([0xffff, 0x0001]).sum).toBe(0x0001);
  });
});

describe('Perbandingan teknik (16 bit, CRC-8)', () => {
  const orig = bitsOf('1001010110110010');
  const flip = (idx: number[]) => orig.map((b, i) => (idx.includes(i) ? 1 - b : b));

  it('1 bit: semua mendeteksi', () => {
    expect(detectAll(orig, flip([5]))).toEqual({ parity: true, parity2d: true, checksum: true, crc: true });
  });

  it('2 bit: parity tunggal lolos', () => {
    const r = detectAll(orig, flip([3, 12]));
    expect(r.parity).toBe(false);
    expect(r.parity2d && r.checksum && r.crc).toBe(true);
  });

  it('4 bit di sudut persegi: parity tunggal dan 2D lolos, CRC tidak', () => {
    const r = detectAll(orig, flip([0, 1, 4, 5]));
    expect(r.parity).toBe(false);
    expect(r.parity2d).toBe(false);
    expect(r.crc).toBe(true);
  });

  it('checksum lolos bila dua bit di posisi sama pada dua byte saling meniadakan (0→1 dan 1→0)', () => {
    // idx 2 = 0 pada byte 1, idx 10 = 1 pada byte 2 (posisi bit yang sama)
    expect([orig[2], orig[10]]).toEqual([0, 1]);
    const r = detectAll(orig, flip([2, 10]));
    expect(r.checksum).toBe(false);
    expect(r.crc).toBe(true);
    expect(r.parity).toBe(false);
  });
});
