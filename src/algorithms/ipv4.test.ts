import { describe, expect, it } from 'vitest';
import { allocateVlsm, blockSize, blocksIn, broadcastOf, flsm, formatIp, fromBits, maskOf, networkOf, parseIp, prefixForHosts, subnetInfo, toBits, usableHosts } from './ipv4';
import { makeRng } from '../core/rng';

const ip = (s: string) => parseIp(s)!;
const f = formatIp;

describe('IPv4 dasar', () => {
  it('parse/format bolak-balik dan menolak masukan tidak sah', () => {
    expect(f(ip('172.16.50.126'))).toBe('172.16.50.126');
    expect(parseIp('256.1.1.1')).toBeNull();
    expect(parseIp('1.2.3')).toBeNull();
    expect(parseIp('a.b.c.d')).toBeNull();
    expect(ip('255.255.255.255')).toBe(4294967295);
  });

  it('konversi biner contoh kuliah: 172.16.50.126', () => {
    expect(toBits(ip('172.16.50.126')).join('')).toBe('10101100000100000011001001111110');
    expect(fromBits(toBits(ip('172.16.50.126')))).toBe(ip('172.16.50.126'));
  });

  it('mask dan jumlah host', () => {
    expect(f(maskOf(0))).toBe('0.0.0.0');
    expect(f(maskOf(24))).toBe('255.255.255.0');
    expect(f(maskOf(26))).toBe('255.255.255.192');
    expect(f(maskOf(27))).toBe('255.255.255.224');
    expect(f(maskOf(32))).toBe('255.255.255.255');
    expect([8, 16, 24, 26, 27, 30].map(usableHosts)).toEqual([16777214, 65534, 254, 62, 30, 2]);
    expect([31, 32].map(usableHosts)).toEqual([2, 1]);
  });
});

describe('Contoh dari slide kuliah', () => {
  it('192.168.19.16/24: blok tunggal 192.168.19.0 – .255', () => {
    const s = subnetInfo(ip('192.168.19.16'), 24);
    expect([f(s.network), f(s.first), f(s.last), f(s.broadcast), s.hosts]).toEqual(['192.168.19.0', '192.168.19.1', '192.168.19.254', '192.168.19.255', 254]);
  });

  it('162.148.139.126/26 berada di blok kedua (.64 – .127) dari 4 blok', () => {
    const s = subnetInfo(ip('162.148.139.126'), 26);
    expect([f(s.network), f(s.broadcast), s.size, s.hosts]).toEqual(['162.148.139.64', '162.148.139.127', 64, 62]);
    expect(blocksIn(ip('162.148.139.0'), 24, 26).map(f)).toEqual(['162.148.139.0', '162.148.139.64', '162.148.139.128', '162.148.139.192']);
  });

  it('192.168.1.70/27 berada di blok 64 – 95', () => {
    const s = subnetInfo(ip('192.168.1.70'), 27);
    expect([f(s.network), f(s.broadcast)]).toEqual(['192.168.1.64', '192.168.1.95']);
  });

  it('VLSM 192.168.10.0/24 untuk 100/50/2 host', () => {
    const r = allocateVlsm({ network: ip('192.168.10.0'), prefix: 24 }, [
      { name: 'Router P2P', hosts: 2 },
      { name: 'Gedung Pusat', hosts: 100 },
      { name: 'Kantor Cabang', hosts: 50 },
    ]);
    expect(r.failed).toBeUndefined();
    expect(r.order.map((n) => n.name)).toEqual(['Gedung Pusat', 'Kantor Cabang', 'Router P2P']);
    expect(r.allocs.map((a) => `${f(a.info.network)}/${a.prefix}`)).toEqual(['192.168.10.0/25', '192.168.10.128/26', '192.168.10.192/30']);
    expect(r.allocs.map((a) => [f(a.info.first), f(a.info.last), f(a.info.broadcast)])).toEqual([
      ['192.168.10.1', '192.168.10.126', '192.168.10.127'],
      ['192.168.10.129', '192.168.10.190', '192.168.10.191'],
      ['192.168.10.193', '192.168.10.194', '192.168.10.195'],
    ]);
    expect(f(r.freeFrom)).toBe('192.168.10.196');
    expect(r.freeAddresses).toBe(60);
  });

  it('FLSM tidak muat untuk 100/50/2: tiga blok /25 butuh 384 alamat', () => {
    const r = flsm({ network: ip('192.168.10.0'), prefix: 24 }, [{ name: 'a', hosts: 100 }, { name: 'b', hosts: 50 }, { name: 'c', hosts: 2 }]);
    expect(r).toEqual({ prefix: 25, size: 128, capacity: 2, fits: false });
  });
});

describe('Prefiks dan alokasi', () => {
  it('prefixForHosts memilih blok terkecil yang cukup', () => {
    expect([1, 2, 3, 6, 7, 30, 31, 62, 63, 100, 254, 255].map((h) => prefixForHosts(h))).toEqual([30, 30, 29, 29, 28, 27, 26, 26, 25, 25, 24, 23]);
    expect(prefixForHosts(2 ** 32)).toBeNull();
  });

  it('melaporkan overflow dan kebutuhan yang lebih besar dari induk', () => {
    const parent = { network: ip('10.0.0.0'), prefix: 24 };
    const over = allocateVlsm(parent, [{ name: 'a', hosts: 120 }, { name: 'b', hosts: 120 }, { name: 'c', hosts: 10 }]);
    expect(over.failed).toEqual({ need: { name: 'c', hosts: 10 }, reason: 'overflow' });
    expect(over.allocs).toHaveLength(2);
    expect(allocateVlsm(parent, [{ name: 'x', hosts: 300 }]).failed!.reason).toBe('too-big');
    // kebutuhan terlalu besar dilewati, yang lain tetap dialokasikan
    const mixed = allocateVlsm({ network: ip('10.0.0.0'), prefix: 25 }, [{ name: 'besar', hosts: 200 }, { name: 'kecil', hosts: 10 }]);
    expect(mixed.failed).toEqual({ need: { name: 'besar', hosts: 200 }, reason: 'too-big' });
    expect(mixed.allocs.map((a) => a.need.name)).toEqual(['kecil']);
    expect(mixed.skipped.map((n) => n.name)).toEqual(['besar']);
  });

  it('properti acak: blok sejajar, tidak tumpang tindih, cukup untuk host, dan kegagalan sah (overflow ⇔ jumlah blok melebihi induk)', () => {
    const rng = makeRng(99);
    for (let t = 0; t < 400; t++) {
      const parent = { network: ip('172.20.0.0'), prefix: 20 + rng.int(9) };
      const total = blockSize(parent.prefix);
      const needs = Array.from({ length: 1 + rng.int(6) }, (_, i) => ({ name: `n${i}`, hosts: 1 + rng.int(200) }));
      const r = allocateVlsm(parent, needs);
      let prevEnd = parent.network;
      for (const a of r.allocs) {
        expect(a.info.network % a.info.size).toBe(0);
        expect(a.info.network).toBeGreaterThanOrEqual(prevEnd);
        expect(a.info.hosts).toBeGreaterThanOrEqual(a.need.hosts);
        expect(a.wasted).toBe(a.info.hosts - a.need.hosts);
        expect(networkOf(a.info.network, parent.prefix)).toBe(parent.network);
        expect(broadcastOf(a.info.network, a.prefix)).toBe(a.info.broadcast);
        prevEnd = a.info.broadcast + 1;
      }
      // keseluruhan alamat terhitung, dan tak ada kebutuhan yang hilang
      expect(r.freeAddresses).toBe(total - r.allocs.reduce((sum, a) => sum + a.info.size, 0));
      expect(r.allocs.length + r.skipped.length).toBe(needs.length);
      // kegagalan 'overflow' sah: blok yang muat dalam induk, bila dijumlah, memang melebihi induk
      const fitting = needs.filter((n) => (prefixForHosts(n.hosts) ?? -1) >= parent.prefix);
      const fitSum = fitting.reduce((sum, n) => sum + blockSize(prefixForHosts(n.hosts)!), 0);
      const overflowed = r.skipped.filter((n) => (prefixForHosts(n.hosts) ?? -1) >= parent.prefix);
      expect(overflowed.length > 0).toBe(fitSum > total);
    }
  });

  it('kasus tepi: mask /1, /31, /32, masukan tidak sah, dan tanpa kebutuhan', () => {
    expect(f(maskOf(1))).toBe('128.0.0.0');
    const p31 = subnetInfo(ip('10.0.0.5'), 31);
    expect([f(p31.first), f(p31.last), p31.hosts]).toEqual(['10.0.0.4', '10.0.0.5', 2]);
    const p32 = subnetInfo(ip('10.0.0.5'), 32);
    expect([f(p32.first), f(p32.last), p32.hosts]).toEqual(['10.0.0.5', '10.0.0.5', 1]);
    expect(f(ip('200.100.50.25'))).toBe('200.100.50.25');
    expect(prefixForHosts(0)).toBeNull();
    expect(prefixForHosts(-3)).toBeNull();
    expect(prefixForHosts(NaN)).toBeNull();
    const empty = allocateVlsm({ network: ip('10.0.0.0'), prefix: 24 }, []);
    expect([empty.allocs.length, empty.freeAddresses]).toEqual([0, 256]);
    expect(flsm({ network: ip('10.0.0.0'), prefix: 24 }, []).fits).toBe(false);
  });
});
