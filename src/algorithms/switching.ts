import { networkOf, parseIp } from './ipv4';

/* ---------- Switch Ethernet: self-learning, forward, flood, filter ---------- */

export type SwitchAction = 'flood' | 'forward' | 'filter';

export const BROADCAST = 'FF';

export interface SwitchFrame {
  src: string;
  dst: string;
}

export type MacTable = Record<string, number>;

export interface SwitchStep {
  frame: SwitchFrame;
  inPort: number;
  /** Entri yang dipelajari dari alamat sumber frame. */
  learned: { mac: string; port: number; isNew: boolean; moved: boolean };
  action: SwitchAction;
  outPorts: number[];
  table: MacTable;
}

/**
 * Switch memproses satu frame: (1) belajar bahwa sumber ada di port masuk, (2) cari tujuan di tabel:
 * tidak ada atau broadcast → flood ke semua port selain port masuk; ada di port lain → forward; ada di port yang sama → filter.
 */
export function switchFrame(table: MacTable, portOf: Record<string, number>, ports: number[], frame: SwitchFrame): SwitchStep {
  const inPort = portOf[frame.src];
  const prev = table[frame.src];
  const next: MacTable = { ...table, [frame.src]: inPort };
  const known = frame.dst !== BROADCAST ? next[frame.dst] : undefined;
  let action: SwitchAction;
  let outPorts: number[];
  if (known === undefined) {
    action = 'flood';
    outPorts = ports.filter((p) => p !== inPort);
  } else if (known === inPort) {
    action = 'filter';
    outPorts = [];
  } else {
    action = 'forward';
    outPorts = [known];
  }
  return { frame, inPort, learned: { mac: frame.src, port: inPort, isNew: prev === undefined, moved: prev !== undefined && prev !== inPort }, action, outPorts, table: next };
}

export function runSwitch(portOf: Record<string, number>, ports: number[], frames: SwitchFrame[], initial: MacTable = {}): SwitchStep[] {
  const out: SwitchStep[] = [];
  let table = initial;
  for (const f of frames) {
    const st = switchFrame(table, portOf, ports, f);
    out.push(st);
    table = st.table;
  }
  return out;
}

/* ---------- ARP ---------- */

export interface Host {
  name: string;
  ip: string;
  mac: string;
}

/** Alamat yang harus di-ARP: tujuan bila satu subnet, selain itu gateway. */
export function arpTarget(srcIp: string, prefix: number, dstIp: string, gatewayIp: string): { ip: string; sameSubnet: boolean } {
  const s = parseIp(srcIp)!;
  const d = parseIp(dstIp)!;
  const same = networkOf(s, prefix) === networkOf(d, prefix);
  return { ip: same ? dstIp : gatewayIp, sameSubnet: same };
}

/** Alamat MAC dalam LaTeX tegak (huruf heksa bukan variabel). */
export const macTex = (mac: string): string => `\\mathrm{${mac.replace(/:/g, '{:}')}}`;

export type ArpKind = 'lookup' | 'request' | 'ignore' | 'learn' | 'reply' | 'cache' | 'data';

export interface ArpEvent {
  kind: ArpKind;
  /** Teks penjelasan (notasi $…$). */
  text: string;
  /** Isi tabel ARP milik pengirim dan target setelah langkah ini (IP → MAC). */
  cacheA: Record<string, string>;
  cacheB: Record<string, string>;
}

/**
 * Pengirim A ingin mengirim ke IP milik B dalam satu subnet. Bila tabel ARP A tidak punya MAC B:
 * A menyiarkan ARP request (broadcast), semua host menerima, hanya B yang membalas (unicast), A menyimpan jawabannya.
 */
export function arpExchange(a: Host, b: Host, bystander: Host, cached: boolean): ArpEvent[] {
  let cacheA: Record<string, string> = cached ? { [b.ip]: b.mac } : {};
  let cacheB: Record<string, string> = {};
  const ev = (kind: ArpKind, text: string): ArpEvent => ({ kind, text, cacheA: { ...cacheA }, cacheB: { ...cacheB } });
  const out: ArpEvent[] = [];
  out.push(ev('lookup', cached ? `${a.name} ingin mengirim ke $${b.ip}$ dan memeriksa tabel ARP: MAC ${b.name} sudah ada ($${macTex(b.mac)}$). Tidak perlu bertanya.` : `${a.name} ingin mengirim ke $${b.ip}$ tetapi tabel ARP kosong: ${a.name} belum tahu MAC-nya.`));
  if (!cached) {
    out.push(ev('request', `${a.name} menyiarkan ARP request ke alamat broadcast $\\mathrm{FF{:}FF{:}FF{:}FF{:}FF{:}FF}$: "siapa pemilik $${b.ip}$?"`));
    out.push(ev('ignore', `${bystander.name} ($${bystander.ip}$) menerima siaran itu, melihat bukan IP-nya, lalu mengabaikannya.`));
    cacheB = { [a.ip]: a.mac };
    out.push(ev('learn', `${b.name} merasa dicari: ia menyimpan pasangan IP–MAC milik ${a.name} dari request tadi.`));
    out.push(ev('reply', `${b.name} membalas langsung (unicast) ke ${a.name}: "$${b.ip}$ ada di MAC $${macTex(b.mac)}$".`));
    cacheA = { [b.ip]: b.mac };
    out.push(ev('cache', `${a.name} menyimpan $${b.ip}\\to ${macTex(b.mac)}$ di tabel ARP-nya (entri ini kedaluwarsa setelah beberapa menit).`));
  }
  out.push(ev('data', `${a.name} kini mengirim frame data ke MAC $${macTex(b.mac)}$.`));
  return out;
}

/* ---------- Pengiriman antar subnet lewat router ---------- */

export interface Endpoint {
  name: string;
  ip: string;
  mac: string;
}

export interface Router {
  inIf: { mac: string };
  outIf: { mac: string };
}

export interface HopFrame {
  hop: number;
  srcMac: string;
  dstMac: string;
  srcIp: string;
  dstIp: string;
  ttl: number;
}

/** Frame di tiap segmen: alamat IP tetap, alamat MAC berganti di setiap hop, TTL berkurang 1 di tiap router. */
export function hopFrames(src: Endpoint, dst: Endpoint, routers: Router[], ttl = 64): HopFrame[] {
  const macs: [string, string][] = [];
  if (routers.length === 0) macs.push([src.mac, dst.mac]);
  else {
    macs.push([src.mac, routers[0].inIf.mac]);
    for (let k = 1; k < routers.length; k++) macs.push([routers[k - 1].outIf.mac, routers[k].inIf.mac]);
    macs.push([routers[routers.length - 1].outIf.mac, dst.mac]);
  }
  return macs.map(([srcMac, dstMac], hop) => ({ hop, srcMac, dstMac, srcIp: src.ip, dstIp: dst.ip, ttl: ttl - hop }));
}
