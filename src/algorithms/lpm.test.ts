import { describe, expect, it } from 'vitest';
import { type Protocol, type Route, cidr, commonBits, lookup, matches, parseCidr } from './lpm';
import { networkOf, parseIp } from './ipv4';
import { makeRng } from '../core/rng';

const ip = (s: string) => parseIp(s)!;
const r = (c: string, nextHop: string, protocol: Protocol = 'static', metric = 0): Route => {
  const p = parseCidr(c)!;
  return { prefix: p.network, len: p.len, nextHop, protocol, metric };
};

describe('Longest prefix match — contoh kuliah', () => {
  const table = [r('0.0.0.0/0', '10.0.0.1'), r('192.168.0.0/16', '10.0.0.2'), r('192.168.1.128/25', '10.0.0.3')];

  it('192.168.1.150 cocok dengan /0, /16, dan /25; /25 menang (10.0.0.3)', () => {
    const res = lookup(table, ip('192.168.1.150'));
    expect(res.matching).toHaveLength(3);
    expect(res.best!.nextHop).toBe('10.0.0.3');
    expect(res.reason).toBe('longest-prefix');
  });

  it('192.168.1.50 hanya cocok dengan /16 dan /0 → /16; 8.8.8.8 → rute default', () => {
    expect(lookup(table, ip('192.168.1.50')).best!.nextHop).toBe('10.0.0.2');
    expect(lookup(table, ip('8.8.8.8')).best!.nextHop).toBe('10.0.0.1');
    expect(lookup(table, ip('8.8.8.8')).reason).toBe('only');
  });

  it('tanpa rute default dan tanpa kecocokan: tidak ada rute', () => {
    const res = lookup(table.slice(1), ip('8.8.8.8'));
    expect(res.best).toBeUndefined();
    expect(res.reason).toBe('none');
  });
});

describe('Administrative Distance dan metrik', () => {
  it('prefiks yang sama: AD terkecil menang (OSPF 110 mengalahkan RIP 120)', () => {
    const res = lookup([r('10.20.0.0/16', 'rip', 'rip', 2), r('10.20.0.0/16', 'ospf', 'ospf', 50)], ip('10.20.1.1'));
    expect(res.best!.nextHop).toBe('ospf');
    expect(res.reason).toBe('admin-distance');
  });

  it('protokol sama: metrik terkecil menang', () => {
    const res = lookup([r('10.20.0.0/16', 'a', 'rip', 5), r('10.20.0.0/16', 'b', 'rip', 2)], ip('10.20.1.1'));
    expect(res.best!.nextHop).toBe('b');
    expect(res.reason).toBe('metric');
  });

  it('prefiks lebih panjang mengalahkan AD yang lebih baik', () => {
    const res = lookup([r('10.20.0.0/16', 'statis', 'static'), r('10.20.5.0/24', 'rip', 'rip', 9)], ip('10.20.5.9'));
    expect(res.best!.nextHop).toBe('rip');
    expect(res.reason).toBe('longest-prefix');
  });

  it('nilai AD bawaan sesuai tabel kuliah', async () => {
    const { AD } = await import('./lpm');
    expect(AD).toEqual({ connected: 0, static: 1, ebgp: 20, ospf: 110, rip: 120, ibgp: 200 });
  });
});

describe('parseCidr', () => {
  it('menerima prefiks yang rata, menolak bit host dan format salah', () => {
    expect(parseCidr('192.168.1.128/25')).toEqual({ network: ip('192.168.1.128'), len: 25 });
    expect(parseCidr('192.168.1.130/25')).toBeNull();
    expect(parseCidr('0.0.0.0/0')).toEqual({ network: 0, len: 0 });
    expect(parseCidr('10.0.0.0/33')).toBeNull();
    expect(parseCidr('10.0.0/8')).toBeNull();
    expect(cidr(r('172.16.0.0/12', 'x'))).toBe('172.16.0.0/12');
  });
});

describe('Properti', () => {
  it('pemenang selalu rute yang cocok dengan prefiks terpanjang', () => {
    const rng = makeRng(31);
    for (let t = 0; t < 500; t++) {
      const routes: Route[] = Array.from({ length: 1 + rng.int(6) }, () => {
        const len = rng.int(33);
        const base = (rng.int(2 ** 16) * 65536 + rng.int(2 ** 16)) >>> 0;
        return { prefix: networkOf(base, len), len, nextHop: String(rng.int(100)), protocol: 'static', metric: rng.int(5) };
      });
      const dest = (rng.int(2 ** 16) * 65536 + rng.int(2 ** 16)) >>> 0;
      const res = lookup(routes, dest);
      const all = routes.filter((x) => matches(x, dest));
      if (all.length === 0) expect(res.best).toBeUndefined();
      else expect(res.best!.len).toBe(Math.max(...all.map((x) => x.len)));
    }
  });

  it('commonBits menghitung bit awal yang sama', () => {
    expect(commonBits(ip('192.168.1.150'), ip('192.168.1.128'))).toBe(27); // ≥ 25, jadi cocok dengan /25
    expect(commonBits(ip('1.2.3.4'), ip('1.2.3.4'))).toBe(32);
    expect(commonBits(ip('128.0.0.0'), ip('0.0.0.0'))).toBe(0);
  });
});
