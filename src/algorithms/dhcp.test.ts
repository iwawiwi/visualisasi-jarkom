import { describe, expect, it } from 'vitest';
import { allocate, apipaAddress, buildDora, isApipa, leasePhase, leaseTimers, poolSize } from './dhcp';
import { parseIp } from './ipv4';

describe('DORA', () => {
  it('satu server: DISCOVER → OFFER → REQUEST → ACK; alamat 192.168.1.50', () => {
    const s = buildDora(1);
    expect(s.messages.map((m) => m.name)).toEqual(['DISCOVER', 'OFFER', 'REQUEST', 'ACK']);
    expect(s.clientIp).toBe('192.168.1.50');
    expect(s.steps.at(-1)!.clientIp).toBe('192.168.1.50');
    expect(s.steps.slice(0, -1).every((x) => x.clientIp === null)).toBe(true);
  });

  it('DISCOVER dan REQUEST disiarkan dari 0.0.0.0:68 ke 255.255.255.255:67; OFFER dan ACK dari port 67 ke 68', () => {
    const s = buildDora(1);
    for (const m of s.messages.filter((x) => x.name === 'DISCOVER' || x.name === 'REQUEST')) expect([m.srcIp, m.dstIp, m.srcPort, m.dstPort]).toEqual(['0.0.0.0', '255.255.255.255', 68, 67]);
    for (const m of s.messages.filter((x) => x.name === 'OFFER' || x.name === 'ACK')) expect([m.srcPort, m.dstPort]).toEqual([67, 68]);
  });

  it('dua server: dua DISCOVER/OFFER/REQUEST, satu ACK dari server yang dipilih, server B menarik tawaran', () => {
    const s = buildDora(2);
    const count = (n: string) => s.messages.filter((m) => m.name === n).length;
    expect([count('DISCOVER'), count('OFFER'), count('REQUEST'), count('ACK')]).toEqual([2, 2, 2, 1]);
    expect(s.chosen).toBe('A');
    expect(s.messages.find((m) => m.name === 'ACK')!.from).toBe('A');
    expect(s.marks.some((k) => k.lane === 'B')).toBe(true);
    expect(s.steps.map((x) => x.t)).toEqual([...s.steps.map((x) => x.t)].sort((a, b) => a - b));
  });

  it('tanpa server: DISCOVER berulang tanpa jawaban lalu alamat APIPA', () => {
    const s = buildDora(0, 5);
    expect(s.messages.every((m) => m.name === 'DISCOVER' && m.lost)).toBe(true);
    expect(s.messages).toHaveLength(3);
    expect(s.chosen).toBeNull();
    expect(isApipa(s.clientIp)).toBe(true);
    expect(s.steps.at(-1)!.clientIp).toBe(s.clientIp);
  });
});

describe('APIPA', () => {
  it('selalu dalam 169.254.1.1 – 169.254.254.254 dan deterministik menurut seed', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const ip = apipaAddress(seed);
      expect(isApipa(ip)).toBe(true);
      const o = ip.split('.').map(Number);
      expect(o[2]).toBeGreaterThanOrEqual(1);
      expect(o[2]).toBeLessThanOrEqual(254);
      expect(o[3]).toBeGreaterThanOrEqual(1);
      expect(o[3]).toBeLessThanOrEqual(254);
      expect(apipaAddress(seed)).toBe(ip);
    }
    expect(isApipa('192.168.1.1')).toBe(false);
  });
});

describe('Sewa', () => {
  it('T1 = 50% dan T2 = 87,5%: sewa 8 jam → perbarui di jam ke-4, cari server mana pun di jam ke-7', () => {
    expect(leaseTimers(8 * 3600)).toEqual({ t1: 4 * 3600, t2: 7 * 3600, expire: 8 * 3600 });
  });

  it('fase menurut waktu berjalan', () => {
    const L = 8 * 3600;
    expect([0, 4 * 3600 - 1, 4 * 3600, 7 * 3600 - 1, 7 * 3600, L - 1, L].map((e) => leasePhase(L, e))).toEqual(['bound', 'bound', 'renewing', 'renewing', 'rebinding', 'rebinding', 'expired']);
  });
});

describe('Pool', () => {
  const pool = { start: parseIp('192.168.10.100')!, end: parseIp('192.168.10.103')! };

  it('mengalokasikan alamat bebas terendah, mengulang alamat lama untuk klien yang sama, dan habis', () => {
    const leases: { mac: string; ip: number }[] = [];
    const got: (number | null)[] = [];
    for (const mac of ['a', 'b', 'c', 'd', 'e']) {
      const ip = allocate(pool, leases, mac);
      got.push(ip);
      if (ip !== null) leases.push({ mac, ip });
    }
    expect(got.slice(0, 4)).toEqual([pool.start, pool.start + 1, pool.start + 2, pool.start + 3]);
    expect(got[4]).toBeNull();
    expect(allocate(pool, leases, 'b')).toBe(pool.start + 1);
    expect(poolSize(pool)).toBe(4);
  });

  it('alamat yang dilepas dipakai kembali lebih dulu', () => {
    const leases = [{ mac: 'a', ip: pool.start }, { mac: 'c', ip: pool.start + 2 }];
    expect(allocate(pool, leases, 'z')).toBe(pool.start + 1);
  });
});
