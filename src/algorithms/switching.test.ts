import { describe, expect, it } from 'vitest';
import { BROADCAST, arpExchange, arpTarget, hopFrames, runSwitch, switchFrame } from './switching';

const portOf = { A: 1, E: 1, B: 2, C: 3, D: 4 };
const ports = [1, 2, 3, 4];

describe('Switch self-learning', () => {
  const frames = [
    { src: 'A', dst: 'C' },
    { src: 'C', dst: 'A' },
    { src: 'D', dst: 'B' },
    { src: 'B', dst: 'D' },
    { src: 'E', dst: 'A' },
    { src: 'A', dst: 'E' },
  ];
  const steps = runSwitch(portOf, ports, frames);

  it('urutan aksi: flood, forward, flood, forward, filter, filter', () => {
    expect(steps.map((s) => s.action)).toEqual(['flood', 'forward', 'flood', 'forward', 'filter', 'filter']);
  });

  it('port keluar: flood ke semua port selain port masuk; forward ke satu port; filter tidak ke mana-mana', () => {
    expect(steps[0].outPorts).toEqual([2, 3, 4]);
    expect(steps[1].outPorts).toEqual([1]);
    expect(steps[2].outPorts).toEqual([1, 2, 3]);
    expect(steps[3].outPorts).toEqual([4]);
    expect(steps[4].outPorts).toEqual([]);
  });

  it('tabel belajar dari alamat sumber, dan entri baru ditandai', () => {
    expect(steps.at(-1)!.table).toEqual({ A: 1, C: 3, D: 4, B: 2, E: 1 });
    expect(steps.map((s) => s.learned.isNew)).toEqual([true, true, true, true, true, false]);
  });

  it('broadcast selalu di-flood walau tujuan "dikenal"', () => {
    const s = switchFrame({ A: 1, B: 2 }, portOf, ports, { src: 'A', dst: BROADCAST });
    expect(s.action).toBe('flood');
    expect(s.outPorts).toEqual([2, 3, 4]);
  });

  it('host yang pindah port memperbarui entri (moved)', () => {
    const s = switchFrame({ A: 3 }, portOf, ports, { src: 'A', dst: 'B' });
    expect(s.learned).toMatchObject({ isNew: false, moved: true, port: 1 });
    expect(s.table.A).toBe(1);
  });
});

describe('ARP', () => {
  const A = { name: 'A', ip: '192.168.1.10', mac: '0A:1A:2B:3C:4D:01' };
  const B = { name: 'B', ip: '192.168.1.20', mac: '0A:1A:2B:3C:4D:02' };
  const C = { name: 'C', ip: '192.168.1.30', mac: '0A:1A:2B:3C:4D:03' };

  it('cache kosong: lookup → request → ignore → learn → reply → cache → data', () => {
    const ev = arpExchange(A, B, C, false);
    expect(ev.map((e) => e.kind)).toEqual(['lookup', 'request', 'ignore', 'learn', 'reply', 'cache', 'data']);
    expect(ev.at(-1)!.cacheA).toEqual({ [B.ip]: B.mac });
    expect(ev.at(-1)!.cacheB).toEqual({ [A.ip]: A.mac });
    expect(ev[1].cacheA).toEqual({});
  });

  it('cache sudah ada: langsung kirim data tanpa ARP', () => {
    expect(arpExchange(A, B, C, true).map((e) => e.kind)).toEqual(['lookup', 'data']);
  });

  it('subnet sama: ARP tujuan; subnet beda: ARP gateway', () => {
    expect(arpTarget('192.168.1.10', 24, '192.168.1.20', '192.168.1.1')).toEqual({ ip: '192.168.1.20', sameSubnet: true });
    expect(arpTarget('192.168.1.10', 24, '192.168.2.20', '192.168.1.1')).toEqual({ ip: '192.168.1.1', sameSubnet: false });
    expect(arpTarget('192.168.1.10', 25, '192.168.1.200', '192.168.1.1').sameSubnet).toBe(false);
  });
});

describe('Frame per hop', () => {
  const src = { name: 'A', ip: '192.168.1.10', mac: 'MAC-A' };
  const dst = { name: 'B', ip: '192.168.2.20', mac: 'MAC-B' };
  const r1 = { inIf: { mac: 'R-1a' }, outIf: { mac: 'R-1b' } };
  const r2 = { inIf: { mac: 'R-2a' }, outIf: { mac: 'R-2b' } };

  it('satu router: IP tetap, MAC berganti, TTL turun 1', () => {
    const f = hopFrames(src, dst, [r1]);
    expect(f).toHaveLength(2);
    expect(f.map((x) => [x.srcMac, x.dstMac])).toEqual([['MAC-A', 'R-1a'], ['R-1b', 'MAC-B']]);
    expect(f.every((x) => x.srcIp === src.ip && x.dstIp === dst.ip)).toBe(true);
    expect(f.map((x) => x.ttl)).toEqual([64, 63]);
  });

  it('dua router: tiga segmen, MAC tujuan selalu hop berikutnya', () => {
    const f = hopFrames(src, dst, [r1, r2]);
    expect(f.map((x) => x.dstMac)).toEqual(['R-1a', 'R-2a', 'MAC-B']);
    expect(f.map((x) => x.srcMac)).toEqual(['MAC-A', 'R-1b', 'R-2b']);
  });

  it('tanpa router: satu frame langsung', () => {
    expect(hopFrames(src, dst, [])).toHaveLength(1);
  });
});
