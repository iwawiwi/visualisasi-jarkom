/** Aritmetika IPv4 murni: alamat disimpan sebagai bilangan bulat 32 bit tak bertanda. */

export const parseIp = (s: string): number | null => {
  const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(s);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
};

export const formatIp = (n: number): string => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

/** Bit paling kiri lebih dulu (panjang `len`, bawaan 32). */
export const toBits = (n: number, len = 32): number[] => Array.from({ length: len }, (_, i) => (n >>> (len - 1 - i)) & 1);

export const fromBits = (bits: number[]): number => bits.reduce((acc, b) => ((acc << 1) | b) >>> 0, 0) >>> 0;

export const maskOf = (prefix: number): number => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

export const networkOf = (ip: number, prefix: number): number => (ip & maskOf(prefix)) >>> 0;

export const broadcastOf = (ip: number, prefix: number): number => (networkOf(ip, prefix) | ~maskOf(prefix)) >>> 0;

/** Jumlah alamat dalam satu blok /prefix (termasuk alamat network dan broadcast). */
export const blockSize = (prefix: number): number => 2 ** (32 - prefix);

/** Jumlah host yang bisa dipakai: blok dikurangi alamat network dan broadcast (/31 = 2 untuk link titik-ke-titik, /32 = 1). */
export const usableHosts = (prefix: number): number => (prefix >= 31 ? (prefix === 31 ? 2 : 1) : blockSize(prefix) - 2);

export interface SubnetInfo {
  ip: number;
  prefix: number;
  mask: number;
  network: number;
  broadcast: number;
  first: number;
  last: number;
  size: number;
  hosts: number;
}

export function subnetInfo(ip: number, prefix: number): SubnetInfo {
  const network = networkOf(ip, prefix);
  const broadcast = broadcastOf(ip, prefix);
  const small = prefix >= 31;
  return {
    ip,
    prefix,
    mask: maskOf(prefix),
    network,
    broadcast,
    first: small ? network : network + 1,
    last: small ? broadcast : broadcast - 1,
    size: blockSize(prefix),
    hosts: usableHosts(prefix),
  };
}

/** Semua blok /`prefix` di dalam blok induk (network `parent`, panjang `parentPrefix`). */
export function blocksIn(parent: number, parentPrefix: number, prefix: number): number[] {
  if (prefix < parentPrefix) return [];
  const step = blockSize(prefix);
  return Array.from({ length: 2 ** (prefix - parentPrefix) }, (_, i) => parent + i * step);
}

/** Prefiks terpanjang (blok terkecil) yang masih memuat `hosts` host; null bila tidak ada. Paling panjang /30. */
export function prefixForHosts(hosts: number): number | null {
  if (!(hosts >= 1)) return null;
  for (let p = 30; p >= 0; p--) if (usableHosts(p) >= hosts) return p;
  return null;
}

export interface Need {
  name: string;
  hosts: number;
}

export interface Alloc {
  need: Need;
  prefix: number;
  info: SubnetInfo;
  /** Host valid yang tidak terpakai di blok ini (host yang bisa dipakai − host yang diminta). */
  wasted: number;
}

export interface VlsmResult {
  /** Kebutuhan terurut dari host terbanyak (stabil untuk yang sama besar). */
  order: Need[];
  allocs: Alloc[];
  /** Kegagalan pertama: 'too-big' (lebih besar dari blok induk, dilewati) atau 'overflow' (ruang habis, alokasi berhenti). */
  failed?: { need: Need; reason: 'overflow' | 'too-big' };
  /** Kebutuhan yang tidak bisa dialokasikan, termasuk yang dilewati karena 'too-big'. */
  skipped: Need[];
  /** Alamat pertama yang belum terpakai (di luar blok induk bila `freeAddresses` = 0), dan jumlah alamat yang masih bebas. */
  freeFrom: number;
  freeAddresses: number;
}

/** VLSM: urutkan dari kebutuhan terbesar, beri blok terkecil yang cukup, tempatkan berurutan (sejajar dengan ukuran blok). */
export function allocateVlsm(parent: { network: number; prefix: number }, needs: Need[]): VlsmResult {
  const order = needs.map((n, i) => ({ n, i })).sort((a, b) => b.n.hosts - a.n.hosts || a.i - b.i).map((x) => x.n);
  const end = parent.network + blockSize(parent.prefix);
  const allocs: Alloc[] = [];
  let cursor = parent.network;
  let failed: VlsmResult['failed'];
  const skipped: Need[] = [];
  for (const need of order) {
    const prefix = prefixForHosts(need.hosts);
    if (prefix === null || prefix < parent.prefix) {
      failed ??= { need, reason: 'too-big' };
      skipped.push(need);
      continue;
    }
    const size = blockSize(prefix);
    const start = Math.ceil((cursor - parent.network) / size) * size + parent.network;
    if (start + size > end) {
      failed ??= { need, reason: 'overflow' };
      skipped.push(need, ...order.slice(order.indexOf(need) + 1).filter((n) => !skipped.includes(n)));
      break;
    }
    const info = subnetInfo(start, prefix);
    allocs.push({ need, prefix, info, wasted: info.hosts - need.hosts });
    cursor = start + size;
  }
  return { order, allocs, failed, skipped, freeFrom: cursor, freeAddresses: end - cursor };
}

export interface FlsmResult {
  prefix: number | null;
  /** Ukuran satu blok (semua blok sama besar). */
  size: number;
  /** Jumlah blok yang tersedia di blok induk. */
  capacity: number;
  fits: boolean;
}

/** FLSM: semua subnet berukuran sama, dipatok pada kebutuhan terbesar. */
export function flsm(parent: { network: number; prefix: number }, needs: Need[]): FlsmResult {
  if (needs.length === 0) return { prefix: null, size: 0, capacity: 0, fits: false };
  const prefix = prefixForHosts(Math.max(...needs.map((n) => n.hosts)));
  if (prefix === null || prefix < parent.prefix) return { prefix, size: prefix === null ? 0 : blockSize(prefix), capacity: 0, fits: false };
  const capacity = 2 ** (prefix - parent.prefix);
  return { prefix, size: blockSize(prefix), capacity, fits: capacity >= needs.length };
}
