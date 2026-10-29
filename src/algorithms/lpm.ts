import { formatIp, networkOf, parseIp } from './ipv4';

export type Protocol = 'connected' | 'static' | 'ebgp' | 'ospf' | 'rip' | 'ibgp';

/** Administrative Distance bawaan: makin kecil makin dipercaya. */
export const AD: Record<Protocol, number> = { connected: 0, static: 1, ebgp: 20, ospf: 110, rip: 120, ibgp: 200 };

export interface Route {
  /** Alamat network (sudah rata terhadap panjang prefiks). */
  prefix: number;
  len: number;
  nextHop: string;
  protocol: Protocol;
  metric: number;
}

/** "192.168.1.128/25" → {network, len}; null bila format salah atau bit host tidak nol. */
export function parseCidr(s: string): { network: number; len: number } | null {
  const m = /^\s*([\d.]+)\s*\/\s*(\d{1,2})\s*$/.exec(s);
  if (!m) return null;
  const ip = parseIp(m[1]);
  const len = Number(m[2]);
  if (ip === null || len > 32 || networkOf(ip, len) !== ip) return null;
  return { network: ip, len };
}

export const cidr = (r: Pick<Route, 'prefix' | 'len'>): string => `${formatIp(r.prefix)}/${r.len}`;

export const matches = (r: Route, ip: number): boolean => networkOf(ip, r.len) === r.prefix;

export type Reason = 'only' | 'longest-prefix' | 'admin-distance' | 'metric' | 'order' | 'none';

export interface LookupResult {
  matching: Route[];
  best?: Route;
  /** Aturan yang menentukan pemenang: prefiks terpanjang, lalu AD terkecil, lalu metrik terkecil. */
  reason: Reason;
}

export function lookup(routes: Route[], ip: number): LookupResult {
  const matching = routes.filter((r) => matches(r, ip));
  if (matching.length === 0) return { matching, reason: 'none' };
  if (matching.length === 1) return { matching, best: matching[0], reason: 'only' };
  const maxLen = Math.max(...matching.map((r) => r.len));
  const byLen = matching.filter((r) => r.len === maxLen);
  if (byLen.length === 1) return { matching, best: byLen[0], reason: 'longest-prefix' };
  const minAd = Math.min(...byLen.map((r) => AD[r.protocol]));
  const byAd = byLen.filter((r) => AD[r.protocol] === minAd);
  if (byAd.length === 1) return { matching, best: byAd[0], reason: 'admin-distance' };
  const minMetric = Math.min(...byAd.map((r) => r.metric));
  const byMetric = byAd.filter((r) => r.metric === minMetric);
  return { matching, best: byMetric[0], reason: byMetric.length === 1 ? 'metric' : 'order' };
}

/** Jumlah bit awal yang sama antara dua alamat. */
export function commonBits(a: number, b: number): number {
  const x = (a ^ b) >>> 0;
  return x === 0 ? 32 : Math.clz32(x);
}
