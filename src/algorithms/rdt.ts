/**
 * Simulasi peristiwa diskrit untuk Reliable Data Transfer: Stop-and-Wait (rdt3.0), Go-Back-N, Selective Repeat.
 * Satuan waktu bebas: kirim → tiba membutuhkan `delay`, pengirim mengirim satu paket per `spacing`.
 * Kehilangan ditentukan eksplisit (bukan acak) agar skenario bisa diulang dan diuji.
 */

export type Protocol = 'saw' | 'gbn' | 'sr';

/** Kunci kehilangan: transmisi ke-`nth` (mulai 1) dari paket data `seq`, atau ACK ke-`nth` yang memuat nomor `seq`. */
export interface LossKey {
  seq: number;
  nth: number;
}

export interface RdtOptions {
  protocol: Protocol;
  /** Jumlah paket yang dikirim. */
  total: number;
  /** Ukuran jendela N (diabaikan untuk Stop-and-Wait: selalu 1). */
  window?: number;
  /** Waktu tempuh satu arah (bawaan 2, jadi RTT = 4). */
  delay?: number;
  /** Batas waktu timer pengirim (bawaan 5). */
  timeout?: number;
  /** Jeda antar pengiriman paket (bawaan 1). */
  spacing?: number;
  loseData?: LossKey[];
  loseAck?: LossKey[];
}

export type StepKind = 'send' | 'recv-data' | 'recv-ack' | 'timeout';

export interface RdtMessage {
  id: string;
  kind: 'data' | 'ack';
  from: 's' | 'r';
  to: 's' | 'r';
  /** Nomor paket (data) atau nomor yang di-ACK (ack). */
  seq: number;
  /** Transmisi ke-berapa (data) atau ACK ke-berapa dengan nomor itu (ack). */
  nth: number;
  t0: number;
  t1: number;
  lost: boolean;
  /** Indeks langkah saat pesan ini muncul. */
  step: number;
}

export interface RdtSnapshot {
  /** Paket tertua yang belum di-ACK, dan nomor urut berikutnya yang akan dikirim pertama kali. */
  base: number;
  nextseq: number;
  /** Per paket: sudah di-ACK oleh pengirim. */
  acked: boolean[];
  /** Per paket: pernah terkirim. */
  sent: boolean[];
  /** Penerima: paket yang sudah diserahkan ke aplikasi (berurutan), dan yang ditahan di buffer (SR). */
  delivered: boolean[];
  buffered: boolean[];
}

export interface RdtStep {
  t: number;
  kind: StepKind;
  seq: number;
  text: string;
  snap: RdtSnapshot;
}

export interface RdtResult {
  steps: RdtStep[];
  messages: RdtMessage[];
  /** Penanda timeout: pada waktu t di pengirim. */
  timeouts: { t: number; seq: number; step: number }[];
  tMax: number;
  /** Jumlah pengiriman ulang paket data. */
  retransmissions: number;
  /** Urutan paket yang diserahkan ke aplikasi penerima. */
  delivered: number[];
  /** Waktu ACK terakhir tiba di pengirim (semua paket sudah di-ACK). */
  finishedAt: number | null;
}

type Kind = 'ack-recv' | 'data-recv' | 'timeout' | 'send';
const PRIO: Record<Kind, number> = { 'ack-recv': 0, 'data-recv': 1, timeout: 2, send: 3 };

interface Ev {
  t: number;
  ord: number;
  kind: Kind;
  seq: number;
  nth?: number;
  timerId?: number;
}

export function runRdt(opts: RdtOptions): RdtResult {
  const { protocol, total } = opts;
  const N = protocol === 'saw' ? 1 : Math.max(1, opts.window ?? 4);
  const D = opts.delay ?? 2;
  const T = opts.timeout ?? 5;
  const gap = opts.spacing ?? 1;
  const lostData = new Set((opts.loseData ?? []).map((k) => `${k.seq}#${k.nth}`));
  const lostAck = new Set((opts.loseAck ?? []).map((k) => `${k.seq}#${k.nth}`));
  const sr = protocol === 'sr';

  const queue: Ev[] = [];
  let ord = 0;
  const push = (e: Omit<Ev, 'ord'>) => queue.push({ ...e, ord: ord++ });

  // pengirim
  let base = 0;
  let nextseq = 0;
  let reserved = 0; // paket yang sudah dijadwalkan kirim pertama kali
  let nextFree = 0;
  const acked = Array<boolean>(total).fill(false);
  const sent = Array<boolean>(total).fill(false);
  const attempts = Array<number>(total).fill(0);
  let tid = 0;
  let timerId = 0; // GBN/SAW: timer tunggal; 0 = tidak aktif
  const srTimer = Array<number>(total).fill(0);
  // penerima
  const delivered = Array<boolean>(total).fill(false);
  const buffered = Array<boolean>(total).fill(false);
  let expected = 0; // SAW/GBN: nomor yang ditunggu; SR: batas bawah jendela terima
  const ackCount = new Map<number, number>();
  const deliveredLog: number[] = [];

  const steps: RdtStep[] = [];
  const messages: RdtMessage[] = [];
  const timeouts: RdtResult['timeouts'] = [];
  let retransmissions = 0;
  let finishedAt: number | null = null;

  const snap = (): RdtSnapshot => ({ base, nextseq, acked: [...acked], sent: [...sent], delivered: [...delivered], buffered: [...buffered] });
  const record = (t: number, kind: StepKind, seq: number, text: string) => {
    steps.push({ t, kind, seq, text, snap: snap() });
    return steps.length - 1;
  };

  const scheduleNew = (t: number) => {
    while (reserved < total && reserved < base + N) {
      const at = Math.max(t, nextFree);
      nextFree = at + gap;
      push({ t: at, kind: 'send', seq: reserved });
      reserved++;
    }
  };
  const startTimer = (t: number, seq: number) => {
    if (sr) {
      srTimer[seq] = ++tid;
      push({ t: t + T, kind: 'timeout', seq, timerId: srTimer[seq] });
    } else {
      timerId = ++tid;
      push({ t: t + T, kind: 'timeout', seq: base, timerId });
    }
  };

  scheduleNew(0);

  const take = (): Ev | undefined => {
    if (queue.length === 0) return undefined;
    let bi = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i];
      const b = queue[bi];
      if (a.t < b.t || (a.t === b.t && (PRIO[a.kind] < PRIO[b.kind] || (PRIO[a.kind] === PRIO[b.kind] && a.ord < b.ord)))) bi = i;
    }
    return queue.splice(bi, 1)[0];
  };

  for (let guard = 0; guard < 2000; guard++) {
    const e = take();
    if (!e) break;
    const { t, seq } = e;

    if (e.kind === 'send') {
      // Pengiriman ulang yang dijadwalkan saat timeout tetapi paketnya sudah di-ACK sebelum waktunya: batal.
      if (attempts[seq] > 0 && (sr ? acked[seq] : seq < base)) continue;
      attempts[seq]++;
      const nth = attempts[seq];
      const isRe = nth > 1;
      if (isRe) retransmissions++;
      sent[seq] = true;
      if (seq >= nextseq) nextseq = seq + 1;
      const lost = lostData.has(`${seq}#${nth}`);
      if (!sr && timerId === 0) startTimer(t, base);
      if (sr && srTimer[seq] === 0) startTimer(t, seq);
      if (!lost) push({ t: t + D, kind: 'data-recv', seq, nth });
      const st = record(t, 'send', seq, `Pengirim ${isRe ? 'mengirim ulang' : 'mengirim'} paket $${seq}$${lost ? ', tetapi paket hilang di jalan.' : '.'}`);
      messages.push({ id: `d${seq}-${nth}`, kind: 'data', from: 's', to: 'r', seq, nth, t0: t, t1: t + D, lost, step: st });
    } else if (e.kind === 'data-recv') {
      let note: string;
      let ackNum = -1;
      if (!sr) {
        if (seq === expected) {
          delivered[seq] = true;
          deliveredLog.push(seq);
          expected++;
          ackNum = seq;
          note = `sesuai urutan: diserahkan ke aplikasi, kirim ACK $${ackNum}$.`;
        } else if (seq < expected) {
          ackNum = expected - 1;
          note = `duplikat (sudah pernah diterima): dibuang, kirim ulang ACK $${ackNum}$.`;
        } else {
          ackNum = expected - 1;
          note = ackNum >= 0 ? `di luar urutan (menunggu $${expected}$): dibuang, kirim ACK $${ackNum}$ lagi.` : `di luar urutan (menunggu $${expected}$): dibuang, belum ada yang bisa di-ACK.`;
        }
      } else {
        if (seq < expected) {
          ackNum = seq;
          note = `duplikat (sudah diserahkan): kirim ulang ACK $${seq}$.`;
        } else if (seq < expected + N) {
          ackNum = seq;
          if (seq === expected) {
            buffered[seq] = true;
            let released = 0;
            while (expected < total && buffered[expected]) {
              buffered[expected] = false;
              delivered[expected] = true;
              deliveredLog.push(expected);
              expected++;
              released++;
            }
            note = released > 1 ? `sesuai urutan: diserahkan ke aplikasi bersama ${released - 1} paket yang tertahan, kirim ACK $${seq}$.` : `sesuai urutan: diserahkan ke aplikasi, kirim ACK $${seq}$.`;
          } else {
            buffered[seq] = true;
            note = `di luar urutan (menunggu $${expected}$): ditahan di buffer, kirim ACK $${seq}$.`;
          }
        } else {
          note = 'di luar jendela terima: dibuang.';
        }
      }
      const st = record(t, 'recv-data', seq, `Penerima menerima paket $${seq}$: ${note}`);
      if (ackNum >= 0) {
        const nth = (ackCount.get(ackNum) ?? 0) + 1;
        ackCount.set(ackNum, nth);
        const lost = lostAck.has(`${ackNum}#${nth}`);
        if (!lost) push({ t: t + D, kind: 'ack-recv', seq: ackNum, nth });
        messages.push({ id: `a${ackNum}-${nth}`, kind: 'ack', from: 'r', to: 's', seq: ackNum, nth, t0: t, t1: t + D, lost, step: st });
        if (lost) steps[st].text += ' ACK ini hilang di jalan.';
      }
    } else if (e.kind === 'ack-recv') {
      let note: string;
      if (!sr) {
        if (seq >= base) {
          for (let i = base; i <= seq; i++) acked[i] = true;
          base = seq + 1;
          timerId = 0;
          if (base < nextseq) startTimer(t, base);
          note =
            protocol === 'saw'
              ? `paket $${seq}$ sudah diterima${base < total ? `, paket berikutnya ($${base}$) boleh dikirim.` : '.'}`
              : `ACK kumulatif: paket sampai $${seq}$ sudah diterima${base < total ? `, jendela bergeser ke $${base}$.` : '.'}`;
          scheduleNew(t);
        } else {
          note = 'ACK lama/ganda: diabaikan.';
        }
      } else if (!acked[seq]) {
        acked[seq] = true;
        srTimer[seq] = 0;
        const old = base;
        while (base < total && acked[base]) base++;
        note = base >= total ? `paket $${seq}$ di-ACK.` : base > old ? `paket $${seq}$ di-ACK, jendela bergeser ke $${base}$.` : `paket $${seq}$ di-ACK (jendela belum bergeser, masih menunggu $${base}$).`;
        scheduleNew(t);
      } else {
        note = 'ACK ganda: diabaikan.';
      }
      if (base >= total && finishedAt === null) {
        finishedAt = t;
        note += ' Semua paket sudah di-ACK.';
      }
      record(t, 'recv-ack', seq, `Pengirim menerima ACK $${seq}$: ${note}`);
    } else {
      // timeout: abaikan timer yang sudah tidak berlaku
      if (sr) {
        if (srTimer[seq] !== e.timerId || acked[seq]) continue;
        srTimer[seq] = 0;
        const st = record(t, 'timeout', seq, `Timeout! Tidak ada ACK untuk paket $${seq}$: kirim ulang hanya paket $${seq}$.`);
        timeouts.push({ t, seq, step: st });
        push({ t: Math.max(t, nextFree), kind: 'send', seq });
        nextFree = Math.max(t, nextFree) + gap;
      } else {
        if (timerId !== e.timerId) continue;
        timerId = 0;
        if (base >= nextseq) continue;
        const from = base;
        const to = nextseq - 1;
        const what = from === to ? `paket $${from}$` : `semua paket $${from}$ sampai $${to}$`;
        const st = record(t, 'timeout', from, `Timeout! Tidak ada ACK untuk paket $${from}$: kirim ulang ${what}.`);
        timeouts.push({ t, seq: from, step: st });
        for (let i = from; i <= to; i++) {
          const at = Math.max(t, nextFree);
          nextFree = at + gap;
          push({ t: at, kind: 'send', seq: i });
        }
      }
    }
  }

  const tMax = messages.reduce((m, x) => Math.max(m, x.t1), 0) + 1;
  return { steps, messages, timeouts, tMax, retransmissions, delivered: deliveredLog, finishedAt };
}

/** Efisiensi (utilisasi) pengirim: bagian waktu yang benar-benar dipakai mengirim bit. */
export function utilization(lengthBits: number, rateBps: number, rttSec: number, windowN = 1): number {
  const tx = lengthBits / rateBps;
  return Math.min(1, (windowN * tx) / (rttSec + tx));
}
