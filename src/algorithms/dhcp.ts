import { formatIp, parseIp } from './ipv4';
import { makeRng } from '../core/rng';

/* ---------- Pertukaran DORA ---------- */

export type DhcpName = 'DISCOVER' | 'OFFER' | 'REQUEST' | 'ACK';
export type Lane = 'C' | 'A' | 'B';

export interface DhcpMessage {
  id: string;
  name: DhcpName;
  from: Lane;
  to: Lane;
  t0: number;
  t1: number;
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  /** Isi penting pesan, dalam teks biasa. */
  note: string;
  lost: boolean;
  step: number;
}

export interface DhcpStep {
  t: number;
  text: string;
  /** Alamat IP klien setelah langkah ini (null = belum punya). */
  clientIp: string | null;
}

export interface DhcpScenario {
  messages: DhcpMessage[];
  steps: DhcpStep[];
  marks: { lane: Lane; t: number; label: string; kind: 'timeout' | 'note'; step: number }[];
  /** Server yang dipilih klien ('A'/'B'), atau null bila tidak ada. */
  chosen: Lane | null;
  clientIp: string;
  tMax: number;
}

const D = 2;
const BCAST = '255.255.255.255';
const SERVER_IP: Record<'A' | 'B', string> = { A: '192.168.1.1', B: '192.168.1.2' };
const OFFERED: Record<'A' | 'B', string> = { A: '192.168.1.50', B: '192.168.1.150' };

/** Alamat APIPA (169.254.0.0/16) yang dipilih klien sendiri bila tidak ada server DHCP; dua oktet terakhir 1–254. */
export function apipaAddress(seed: number): string {
  const rng = makeRng(seed);
  return `169.254.${1 + rng.int(254)}.${1 + rng.int(254)}`;
}

export const isApipa = (ip: string): boolean => {
  const n = parseIp(ip);
  return n !== null && n >>> 16 === (169 << 8) + 254;
};

/** servers: 1, 2 (dua server menawarkan), atau 0 (tidak ada yang menjawab → APIPA). */
export function buildDora(servers: 0 | 1 | 2, seed = 1): DhcpScenario {
  const messages: DhcpMessage[] = [];
  const steps: DhcpStep[] = [];
  const marks: DhcpScenario['marks'] = [];
  let n = 0;
  const step = (t: number, text: string, clientIp: string | null): number => (steps.push({ t, text, clientIp }), steps.length - 1);
  const msg = (name: DhcpName, from: Lane, to: Lane, t0: number, srcIp: string, dstIp: string, srcPort: number, dstPort: number, note: string, st: number, lost = false) => {
    messages.push({ id: `m${n++}`, name, from, to, t0, t1: t0 + D, srcIp, dstIp, srcPort, dstPort, note, lost, step: st });
  };
  const toClient = (name: DhcpName, s: 'A' | 'B', t: number, note: string, st: number) => msg(name, s, 'C', t, SERVER_IP[s], BCAST, 67, 68, note, st);

  if (servers === 0) {
    let t = 0;
    for (let k = 0; k < 3; k++) {
      const st = step(t, k === 0 ? 'Klien baru menyala dan belum punya IP. Ia menyiarkan DHCPDISCOVER (sumber $0.0.0.0$, tujuan $255.255.255.255$, UDP $68\\to 67$).' : `Tidak ada jawaban. Klien mengirim ulang DHCPDISCOVER (percobaan ke-$${k + 1}$).`, null);
      msg('DISCOVER', 'C', 'A', t, '0.0.0.0', BCAST, 68, 67, 'mencari server DHCP', st, true);
      t += 4;
      if (k < 2) marks.push({ lane: 'C', t, label: 'timeout', kind: 'timeout', step: st + 1 });
    }
    const ip = apipaAddress(seed);
    step(t, `Tetap tidak ada server DHCP. Klien memberi dirinya alamat APIPA acak ${ip} (rentang $169.254.0.0/16$, tanpa gateway). Ia hanya bisa berkomunikasi dengan host lain di segmen yang sama.`, ip);
    return { messages, steps, marks, chosen: null, clientIp: ip, tMax: t + 1 };
  }

  const names: ('A' | 'B')[] = servers === 2 ? ['A', 'B'] : ['A'];
  let t = 0;
  let st = step(t, `Klien baru menyala tanpa IP. Ia menyiarkan DHCPDISCOVER: sumber $0.0.0.0$, tujuan $255.255.255.255$, UDP port $68\\to 67$, dengan MAC-nya.`, null);
  for (const s of names) msg('DISCOVER', 'C', s, t, '0.0.0.0', BCAST, 68, 67, 'cari server DHCP (broadcast)', st);
  t += D;
  for (const s of names) {
    st = step(t, `Server ${s} ($${SERVER_IP[s]}$) memeriksa pool-nya dan menawarkan $${OFFERED[s]}$ lewat DHCPOFFER (beserta mask, gateway, DNS, dan lama sewa).`, null);
    toClient('OFFER', s, t, `tawaran ${OFFERED[s]}`, st);
    t += 1;
  }
  const chosen: Lane = 'A';
  const ip = OFFERED.A;
  t += D;
  st = step(t, servers === 2 ? `Klien menerima dua tawaran dan memilih yang pertama datang (server A). Ia menyiarkan DHCPREQUEST untuk $${ip}$ dan menyebut server A; siaran ini juga memberi tahu server B bahwa tawarannya ditolak.` : `Klien menerima tawaran dan menyiarkan DHCPREQUEST: "aku mau $${ip}$". Disiarkan (broadcast) agar server lain tahu tawarannya tidak dipakai.`, null);
  for (const s of names) msg('REQUEST', 'C', s, t, '0.0.0.0', BCAST, 68, 67, `minta ${ip} dari server A`, st);
  t += D;
  if (servers === 2) {
    marks.push({ lane: 'B', t, label: 'tawaran ditarik', kind: 'note', step: steps.length });
    st = step(t, 'Server B melihat klien memilih server lain: ia menarik tawarannya dan mengembalikan $192.168.1.150$ ke pool.', null);
    t += 1;
  }
  st = step(t, `Server A mencatat sewa $${ip}$ untuk MAC klien dan mengirim DHCPACK (konfirmasi + pengaturan jaringan).`, null);
  toClient('ACK', 'A', t, `konfirmasi ${ip}, mask, gateway, DNS, sewa`, st);
  t += D;
  step(t, `Klien menerima ACK dan mulai memakai $${ip}$. Sewa berlaku selama waktu yang ditentukan server.`, ip);
  return { messages, steps, marks, chosen, clientIp: ip, tMax: t + 1 };
}

/* ---------- Sewa (lease) ---------- */

export interface LeaseTimers {
  /** Detik sejak awal sewa: mulai memperbarui (unicast ke server asal), mulai mencari server mana pun (broadcast), dan sewa habis. */
  t1: number;
  t2: number;
  expire: number;
}

export const leaseTimers = (leaseSecs: number): LeaseTimers => ({ t1: leaseSecs * 0.5, t2: leaseSecs * 0.875, expire: leaseSecs });

export type LeasePhase = 'bound' | 'renewing' | 'rebinding' | 'expired';

export function leasePhase(leaseSecs: number, elapsed: number): LeasePhase {
  const t = leaseTimers(leaseSecs);
  if (elapsed >= t.expire) return 'expired';
  if (elapsed >= t.t2) return 'rebinding';
  if (elapsed >= t.t1) return 'renewing';
  return 'bound';
}

/* ---------- Pool alamat ---------- */

export interface Pool {
  /** Alamat pertama dan terakhir yang boleh disewakan. */
  start: number;
  end: number;
}

export interface Lease {
  mac: string;
  ip: number;
}

/** Beri klien alamat bebas terendah (atau alamat lamanya bila ia sudah punya sewa); null bila pool habis. */
export function allocate(pool: Pool, leases: Lease[], mac: string): number | null {
  const existing = leases.find((l) => l.mac === mac);
  if (existing) return existing.ip;
  const used = new Set(leases.map((l) => l.ip));
  for (let ip = pool.start; ip <= pool.end; ip++) if (!used.has(ip)) return ip;
  return null;
}

export const poolSize = (pool: Pool): number => pool.end - pool.start + 1;
export { formatIp };
