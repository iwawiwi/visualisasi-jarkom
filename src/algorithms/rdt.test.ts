import { describe, expect, it } from 'vitest';
import { type Protocol, type RdtOptions, runRdt, utilization } from './rdt';
import { makeRng } from '../core/rng';

const data = (r: ReturnType<typeof runRdt>) => r.messages.filter((m) => m.kind === 'data');
const seqs = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('Stop-and-Wait (rdt3.0)', () => {
  it('tanpa gangguan: satu paket per RTT, selesai di t = 16 untuk 4 paket', () => {
    const r = runRdt({ protocol: 'saw', total: 4 });
    expect(data(r).map((m) => m.t0)).toEqual([0, 4, 8, 12]);
    expect(r.retransmissions).toBe(0);
    expect(r.delivered).toEqual(seqs(4));
    expect(r.finishedAt).toBe(16);
  });

  it('paket hilang: timeout di t = 9 lalu kirim ulang', () => {
    const r = runRdt({ protocol: 'saw', total: 4, loseData: [{ seq: 1, nth: 1 }] });
    expect(r.timeouts.map((x) => x.t)).toEqual([9]);
    expect(data(r).filter((m) => m.seq === 1).map((m) => [m.t0, m.lost])).toEqual([[4, true], [9, false]]);
    expect(r.delivered).toEqual(seqs(4));
    expect(r.retransmissions).toBe(1);
  });

  it('ACK hilang: paket dikirim ulang, penerima membuang duplikat dan tetap meng-ACK', () => {
    const r = runRdt({ protocol: 'saw', total: 4, loseAck: [{ seq: 1, nth: 1 }] });
    expect(r.retransmissions).toBe(1);
    expect(r.delivered).toEqual(seqs(4)); // setiap paket hanya sekali ke aplikasi
    expect(r.messages.filter((m) => m.kind === 'ack' && m.seq === 1)).toHaveLength(2);
  });

  it('timeout prematur (3 < RTT 4): ada duplikat tanpa kehilangan apa pun', () => {
    const r = runRdt({ protocol: 'saw', total: 3, timeout: 3 });
    expect(r.retransmissions).toBeGreaterThan(0);
    expect(r.delivered).toEqual(seqs(3));
    expect(r.finishedAt).not.toBeNull();
  });
});

describe('Go-Back-N dan Selective Repeat (N = 4, 6 paket, paket 2 hilang)', () => {
  const loss: Partial<RdtOptions> = { total: 6, window: 4, loseData: [{ seq: 2, nth: 1 }] };

  it('GBN: timeout mengirim ulang paket 2 sampai 5 (4 pengiriman ulang)', () => {
    const r = runRdt({ protocol: 'gbn', ...loss } as RdtOptions);
    expect(r.timeouts.map((x) => [x.t, x.seq])).toEqual([[10, 2]]);
    expect(data(r)).toHaveLength(10);
    expect(r.retransmissions).toBe(4);
    expect(r.delivered).toEqual(seqs(6));
  });

  it('SR: hanya paket 2 yang dikirim ulang, yang lain ditahan di buffer', () => {
    const r = runRdt({ protocol: 'sr', ...loss } as RdtOptions);
    expect(data(r)).toHaveLength(7);
    expect(r.retransmissions).toBe(1);
    expect(r.delivered).toEqual(seqs(6));
    // paket 3 tiba lebih dulu daripada 2 dan sempat tertahan di buffer
    expect(r.steps.some((s) => s.snap.buffered[3])).toBe(true);
  });

  it('GBN: ACK kumulatif menutupi ACK yang hilang (tanpa pengiriman ulang)', () => {
    const r = runRdt({ protocol: 'gbn', total: 6, window: 4, loseAck: [{ seq: 1, nth: 1 }] });
    expect(r.retransmissions).toBe(0);
    expect(r.delivered).toEqual(seqs(6));
  });

  it('GBN tanpa gangguan menyelesaikan 6 paket jauh lebih cepat daripada Stop-and-Wait', () => {
    const gbn = runRdt({ protocol: 'gbn', total: 6, window: 4 });
    const saw = runRdt({ protocol: 'saw', total: 6 });
    expect(gbn.finishedAt!).toBeLessThan(saw.finishedAt!);
    expect(gbn.retransmissions).toBe(0);
  });
});

describe('Properti: kehilangan acak', () => {
  it('semua protokol selesai, menyerahkan setiap paket tepat sekali dan berurutan, tanpa mengirim ulang paket yang sudah di-ACK', () => {
    const rng = makeRng(7);
    const protocols: Protocol[] = ['saw', 'gbn', 'sr'];
    for (let t = 0; t < 1500; t++) {
      const protocol = protocols[rng.int(3)];
      const total = 2 + rng.int(6);
      const loseData: { seq: number; nth: number }[] = [];
      const loseAck: { seq: number; nth: number }[] = [];
      for (let s = 0; s < total; s++) {
        for (const nth of [1, 2]) {
          if (rng.chance(0.3)) loseData.push({ seq: s, nth });
          if (rng.chance(0.3)) loseAck.push({ seq: s, nth });
        }
      }
      // timeout 3–8 (termasuk lebih pendek dari RTT = 4) dan jendela 1–5
      const r = runRdt({ protocol, total, window: 1 + rng.int(5), timeout: 3 + rng.int(6), loseData, loseAck });
      const label = `${protocol} ${JSON.stringify({ total, loseData, loseAck })}`;
      expect(r.finishedAt, label).not.toBeNull();
      expect(r.delivered, label).toEqual(seqs(total));
      const times = r.steps.map((s) => s.t);
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(r.steps.at(-1)!.snap.acked.every(Boolean)).toBe(true);
      // tidak ada pengiriman paket yang sudah di-ACK
      for (const st of r.steps) if (st.kind === 'send') expect(st.snap.acked[st.seq], label).toBe(false);
    }
  });

  it('kasus yang dulu macet: GBN N=4, timeout 3, semua ACK pertama hilang selain ACK 3', () => {
    const r = runRdt({ protocol: 'gbn', total: 6, window: 4, timeout: 3, loseAck: [0, 1, 2, 4, 5].map((seq) => ({ seq, nth: 1 })) });
    expect(r.finishedAt).not.toBeNull();
    expect(r.delivered).toEqual(seqs(6));
  });
});

describe('Utilisasi', () => {
  it('contoh buku: 8000 bit, 1 Gbps, RTT 30 ms → ≈ 0,00027; jendela 3 paket tiga kali lebih besar', () => {
    const u1 = utilization(8000, 1e9, 0.03, 1);
    expect(u1).toBeCloseTo(0.00027, 5);
    expect(utilization(8000, 1e9, 0.03, 3)).toBeCloseTo(3 * u1, 6);
    expect(utilization(8000, 1e9, 0.03, 1e6)).toBe(1);
  });
});
