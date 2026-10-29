import { type Graph, type NodeId, neighbors, nodeIds } from '../core/graph';

/** LSDB tiap router: untuk setiap asal LSA, nomor urut terbaru yang tersimpan (0 / tidak ada = belum punya). */
export type LSDB = Record<NodeId, Record<NodeId, number>>;

export interface Lsa {
  origin: NodeId;
  seq: number;
  links: { to: NodeId; w: number }[];
}

export type DeliveryResult = 'new' | 'duplicate' | 'again';

export interface Delivery {
  from: NodeId;
  to: NodeId;
  origin: NodeId;
  seq: number;
  /** new = disimpan & diteruskan; duplicate = dibuang; again = (tanpa nomor urut) diteruskan lagi. */
  result: DeliveryResult;
}

export interface FloodStep {
  round: number;
  /** Pesan yang tiba pada ronde ini. */
  deliveries: Delivery[];
  /** Isi LSDB setiap router setelah ronde ini. */
  lsdb: LSDB;
  messages: number;
  total: number;
  newCount: number;
  dupCount: number;
  text: string;
}

export interface FloodResult {
  steps: FloodStep[];
  /** true bila simulasi dihentikan oleh batas ronde (flooding tanpa nomor urut tidak pernah berhenti). */
  capped: boolean;
  total: number;
  lsdb: LSDB;
}

export interface FloodOptions {
  /** Router yang menyiarkan LSA di ronde 0. */
  origins: NodeId[];
  /** Nomor urut LSA yang disiarkan (bawaan 1). */
  seq?: number;
  /** Isi LSDB awal (mis. peta lama sebelum link berubah). */
  initial?: LSDB;
  /** Bila false: tiap pesan diteruskan lagi tanpa memeriksa nomor urut. */
  useSeq?: boolean;
  maxRounds?: number;
}

export const emptyLsdb = (g: Graph): LSDB => Object.fromEntries(nodeIds(g).map((id) => [id, {}]));

/** LSDB lengkap: semua router sudah memegang LSA semua router dengan nomor urut `seq`. */
export const fullLsdb = (g: Graph, seq = 1): LSDB =>
  Object.fromEntries(nodeIds(g).map((id) => [id, Object.fromEntries(nodeIds(g).map((o) => [o, seq]))]));

/** Isi LSA sebuah router: daftar tetangga langsung dan biaya link-nya. */
export function lsaOf(g: Graph, origin: NodeId, seq = 1): Lsa {
  return { origin, seq, links: neighbors(g, origin).map((n) => ({ to: n.id, w: n.w })) };
}

const cloneLsdb = (d: LSDB): LSDB => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { ...v }]));

interface Msg {
  from: NodeId;
  to: NodeId;
  origin: NodeId;
  seq: number;
}

/**
 * Simulasi flooding LSA per ronde (sinkron): pada tiap ronde semua pesan yang sedang dikirim tiba bersamaan.
 * Router yang menerima LSA baru menyimpannya lalu meneruskannya ke semua tetangga kecuali pengirim;
 * LSA duplikat dibuang. Jumlah pesan total = 2m − (n − 1) per LSA pada graf terhubung dengan m link dan n router.
 */
export function runFlooding(g: Graph, opts: FloodOptions): FloodResult {
  const { origins, seq = 1, useSeq = true, maxRounds = useSeq ? 40 : 6 } = opts;
  const lsdb = opts.initial ? cloneLsdb(opts.initial) : emptyLsdb(g);
  for (const id of nodeIds(g)) lsdb[id] ??= {};
  let pending: Msg[] = [];
  for (const o of origins) {
    lsdb[o][o] = Math.max(lsdb[o][o] ?? 0, seq);
    for (const n of neighbors(g, o)) pending.push({ from: o, to: n.id, origin: o, seq });
  }

  const steps: FloodStep[] = [
    {
      round: 0,
      deliveries: [],
      lsdb: cloneLsdb(lsdb),
      messages: 0,
      total: 0,
      newCount: 0,
      dupCount: 0,
      text:
        origins.length === 1
          ? pending.length === 0
            ? `Awal: router $${origins[0]}$ menyimpan LSA-nya sendiri, tetapi tidak punya tetangga untuk dikirimi.`
            : `Awal: router $${origins[0]}$ menyimpan LSA-nya sendiri dan mengirimnya ke ${pending.length} tetangga.`
          : `Awal: ${origins.length} router menyimpan LSA-nya sendiri dan mengirimnya ke semua tetangga.`,
    },
  ];

  let total = 0;
  let round = 0;
  while (pending.length > 0 && round < maxRounds) {
    round++;
    pending.sort((a, b) => a.origin.localeCompare(b.origin) || a.to.localeCompare(b.to) || a.from.localeCompare(b.from));
    const deliveries: Delivery[] = [];
    const next: Msg[] = [];
    for (const m of pending) {
      const stored = lsdb[m.to][m.origin] ?? 0;
      let result: DeliveryResult;
      if (useSeq) result = m.seq > stored ? 'new' : 'duplicate';
      else result = m.seq > stored ? 'new' : 'again';
      if (m.seq > stored) lsdb[m.to][m.origin] = m.seq;
      if (result !== 'duplicate') {
        for (const n of neighbors(g, m.to)) if (n.id !== m.from) next.push({ from: m.to, to: n.id, origin: m.origin, seq: m.seq });
      }
      deliveries.push({ ...m, result });
    }
    total += deliveries.length;
    const newCount = deliveries.filter((d) => d.result === 'new').length;
    const dupCount = deliveries.length - newCount;
    pending = next;
    const finished = pending.length === 0;
    let text = `Ronde ${round}: ${deliveries.length} pesan tiba. ${newCount} berisi LSA baru (disimpan lalu diteruskan)`;
    text += useSeq ? `, ${dupCount} duplikat (dibuang).` : `, ${dupCount} diteruskan lagi tanpa dicek.`;
    if (finished) text += ' Tidak ada pesan yang tersisa: flooding selesai.';
    steps.push({ round, deliveries, lsdb: cloneLsdb(lsdb), messages: deliveries.length, total, newCount, dupCount, text });
  }

  return { steps, capped: pending.length > 0, total, lsdb };
}

/** Apakah semua router sudah memegang LSA dari semua `origins` dengan nomor urut ≥ `seq`? */
export function lsdbHas(lsdb: LSDB, origins: NodeId[], seq = 1): boolean {
  return Object.values(lsdb).every((row) => origins.every((o) => (row[o] ?? 0) >= seq));
}
