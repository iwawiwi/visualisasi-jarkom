import { describe, expect, it } from 'vitest';
import { buildHandshake, buildTeardown, transferTable } from './tcpConn';

const fl = (s: { flags: string[] }) => s.flags.join('+');

describe('3-way handshake', () => {
  const sc = buildHandshake({ isnC: 1000, isnS: 5000 });

  it('SYN(x) → SYN+ACK(y, x+1) → ACK(x+1, y+1)', () => {
    expect(sc.segments.map((s) => [fl(s), s.from, s.seq, s.ack])).toEqual([
      ['SYN', 'C', 1000, undefined],
      ['SYN+ACK', 'S', 5000, 1001],
      ['ACK', 'C', 1001, 5001],
    ]);
    expect(sc.segments.every((s) => s.len === 0 && !s.lost)).toBe(true);
  });

  it('status: klien SYN_SENT → ESTABLISHED, server LISTEN → SYN_RCVD → ESTABLISHED', () => {
    expect(sc.steps.map((s) => [s.client, s.server])).toEqual([
      ['SYN_SENT', 'LISTEN'],
      ['SYN_SENT', 'SYN_RCVD'],
      ['ESTABLISHED', 'SYN_RCVD'],
      ['ESTABLISHED', 'ESTABLISHED'],
    ]);
    expect(sc.segments.map((s) => s.step)).toEqual([0, 1, 2]);
  });

  it('SYN hilang: timeout lalu SYN dikirim ulang dengan nomor urut yang sama', () => {
    const l = buildHandshake({ isnC: 1000, isnS: 5000, loseSyn: true });
    expect(l.segments.map((s) => [fl(s), s.lost])).toEqual([['SYN', true], ['SYN', false], ['SYN+ACK', false], ['ACK', false]]);
    expect(l.segments[1].seq).toBe(1000);
    expect(l.timeouts).toHaveLength(1);
    expect(l.steps.at(-1)).toMatchObject({ client: 'ESTABLISHED', server: 'ESTABLISHED' });
  });

  it('SYN+ACK hilang: SYN ganda dijawab SYN+ACK yang sama', () => {
    const l = buildHandshake({ isnC: 1000, isnS: 5000, loseSynAck: true });
    expect(l.segments.map((s) => [fl(s), s.from, s.lost])).toEqual([['SYN', 'C', false], ['SYN+ACK', 'S', true], ['SYN', 'C', false], ['SYN+ACK', 'S', false], ['ACK', 'C', false]]);
    expect(l.segments[3]).toMatchObject({ seq: 5000, ack: 1001 });
    expect(l.steps.at(-1)).toMatchObject({ client: 'ESTABLISHED', server: 'ESTABLISHED' });
    // waktu tiba selalu setelah waktu kirim dan langkah berurutan menurut waktu
    expect(l.segments.every((s) => s.t1 > s.t0)).toBe(true);
    expect(l.steps.map((s) => s.t)).toEqual([...l.steps.map((s) => s.t)].sort((a, b) => a - b));
  });
});

describe('Transfer: nomor urut per byte dan ACK kumulatif', () => {
  it('tanpa kehilangan: ack = seq + len', () => {
    const rows = transferTable({ start: 1001, sizes: [100, 200, 50] });
    expect(rows.map((r) => [r.seq, r.ack])).toEqual([[1001, 1101], [1101, 1301], [1301, 1351]]);
    expect(rows.some((r) => r.dupAck)).toBe(false);
  });

  it('segmen ke-1 hilang: ACK segmen berikutnya sama dengan ACK SYN+ACK, jadi sudah ganda', () => {
    const rows = transferTable({ start: 1001, sizes: [100, 200, 50], lose: 0 });
    expect(rows[1]).toMatchObject({ ack: 1001, dupAck: true });
    expect(rows[2]).toMatchObject({ ack: 1001, dupAck: true });
  });

  it('segmen ke-2 hilang: segmen ke-3 menghasilkan ACK ganda 1101', () => {
    const rows = transferTable({ start: 1001, sizes: [100, 200, 50], lose: 1 });
    expect(Number.isNaN(rows[1].ack)).toBe(true);
    expect(rows[2]).toMatchObject({ seq: 1301, ack: 1101, dupAck: true });
  });
});

describe('4-way teardown', () => {
  const sc = buildTeardown({ seqC: 2001, seqS: 7001 });

  it('FIN(a) → ACK(a+1) → FIN(b) → ACK(b+1); FIN memakan satu nomor urut', () => {
    expect(sc.segments.map((s) => [fl(s), s.from, s.seq, s.ack])).toEqual([
      ['FIN', 'C', 2001, undefined],
      ['ACK', 'S', 7001, 2002],
      ['FIN', 'S', 7001, undefined],
      ['ACK', 'C', 2002, 7002],
    ]);
  });

  it('klien melewati FIN_WAIT_1, FIN_WAIT_2, TIME_WAIT; server CLOSE_WAIT dan LAST_ACK; keduanya akhirnya CLOSED', () => {
    const c = sc.steps.map((s) => s.client);
    const s = sc.steps.map((x) => x.server);
    for (const k of ['FIN_WAIT_1', 'FIN_WAIT_2', 'TIME_WAIT']) expect(c).toContain(k);
    for (const k of ['CLOSE_WAIT', 'LAST_ACK']) expect(s).toContain(k);
    expect(sc.steps.at(-1)).toMatchObject({ client: 'CLOSED', server: 'CLOSED' });
  });
});
