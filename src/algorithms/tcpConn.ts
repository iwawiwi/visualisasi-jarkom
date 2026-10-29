/** Skenario koneksi TCP: 3-way handshake, transfer data (nomor urut per byte), dan 4-way teardown. */

export type TcpState = 'CLOSED' | 'LISTEN' | 'SYN_SENT' | 'SYN_RCVD' | 'ESTABLISHED' | 'FIN_WAIT_1' | 'FIN_WAIT_2' | 'CLOSE_WAIT' | 'LAST_ACK' | 'TIME_WAIT';
export type Side = 'C' | 'S';
export type Flag = 'SYN' | 'ACK' | 'FIN';

export interface Segment {
  id: string;
  from: Side;
  to: Side;
  /** Waktu kirim dan tiba. */
  t0: number;
  t1: number;
  flags: Flag[];
  seq: number;
  /** Nomor ACK (hanya bila flag ACK menyala). */
  ack?: number;
  /** Jumlah byte data. */
  len: number;
  lost: boolean;
  /** Indeks langkah saat segmen ini dikirim. */
  step: number;
}

export interface ConnStep {
  t: number;
  text: string;
  client: TcpState;
  server: TcpState;
}

export interface ConnScenario {
  segments: Segment[];
  steps: ConnStep[];
  /** Penanda timeout di sisi pengirim. */
  timeouts: { side: Side; t: number; step: number }[];
  tMax: number;
}

const D = 2; // waktu rambat satu arah
const RTO = 5; // batas waktu retransmisi

class Builder {
  segments: Segment[] = [];
  steps: ConnStep[] = [];
  timeouts: ConnScenario['timeouts'] = [];
  private n = 0;
  client: TcpState;
  server: TcpState;
  constructor(client: TcpState, server: TcpState) {
    this.client = client;
    this.server = server;
  }
  /** Catat satu langkah dan kembalikan indeksnya. */
  step(t: number, text: string, client: TcpState, server: TcpState): number {
    this.client = client;
    this.server = server;
    this.steps.push({ t, text, client, server });
    return this.steps.length - 1;
  }
  seg(from: Side, t0: number, flags: Flag[], seq: number, ack: number | undefined, len: number, lost: boolean, step: number): Segment {
    const s: Segment = { id: `s${this.n++}`, from, to: from === 'C' ? 'S' : 'C', t0, t1: t0 + D, flags, seq, ack, len, lost, step };
    this.segments.push(s);
    return s;
  }
  done(): ConnScenario {
    return { segments: this.segments, steps: this.steps, timeouts: this.timeouts, tMax: Math.max(...this.segments.map((s) => s.t1), ...this.steps.map((s) => s.t)) + 1 };
  }
}

export interface HandshakeOptions {
  /** Nomor urut awal klien (x) dan server (y). */
  isnC: number;
  isnS: number;
  loseSyn?: boolean;
  loseSynAck?: boolean;
}

/** 3-way handshake: SYN(seq=x) → SYN+ACK(seq=y, ack=x+1) → ACK(seq=x+1, ack=y+1). */
export function buildHandshake({ isnC: x, isnS: y, loseSyn = false, loseSynAck = false }: HandshakeOptions): ConnScenario {
  const b = new Builder('CLOSED', 'LISTEN');
  let t = 0;
  let st = b.step(t, `Server memanggil listen() dan menunggu (LISTEN). Klien memanggil connect(): ia memilih nomor urut awal $x=${x}$ dan mengirim SYN.`, 'SYN_SENT', 'LISTEN');
  b.seg('C', t, ['SYN'], x, undefined, 0, loseSyn, st);

  if (loseSyn) {
    t += RTO;
    st = b.step(t, `SYN hilang di jalan. Tidak ada balasan sampai timeout: klien mengirim ulang SYN yang sama ($\\mathrm{seq}=${x}$).`, 'SYN_SENT', 'LISTEN');
    b.timeouts.push({ side: 'C', t, step: st });
    b.seg('C', t, ['SYN'], x, undefined, 0, false, st);
  }
  t += D;
  st = b.step(t, `Server menerima SYN. Ia memilih nomor urut sendiri $y=${y}$ dan membalas SYN+ACK dengan $\\mathrm{ack}=x+1=${x + 1}$ ("SYN diterima, aku menunggu byte berikutnya").`, 'SYN_SENT', 'SYN_RCVD');
  b.seg('S', t, ['SYN', 'ACK'], y, x + 1, 0, loseSynAck, st);

  if (loseSynAck) {
    t += RTO;
    st = b.step(t, `SYN+ACK hilang, jadi klien tidak mendapat balasan: timeout, ia mengirim ulang SYN ($\\mathrm{seq}=${x}$).`, 'SYN_SENT', 'SYN_RCVD');
    b.timeouts.push({ side: 'C', t, step: st });
    b.seg('C', t, ['SYN'], x, undefined, 0, false, st);
    t += D;
    st = b.step(t, `Server menerima SYN ganda dan mengirim ulang SYN+ACK yang sama ($\\mathrm{seq}=${y}$, $\\mathrm{ack}=${x + 1}$).`, 'SYN_SENT', 'SYN_RCVD');
    b.seg('S', t, ['SYN', 'ACK'], y, x + 1, 0, false, st);
  }
  t += D;
  st = b.step(t, `Klien menerima SYN+ACK: koneksi di sisinya terbentuk (ESTABLISHED). Ia mengirim ACK dengan $\\mathrm{seq}=x+1=${x + 1}$, $\\mathrm{ack}=y+1=${y + 1}$.`, 'ESTABLISHED', 'SYN_RCVD');
  b.seg('C', t, ['ACK'], x + 1, y + 1, 0, false, st);
  t += D;
  b.step(t, 'Server menerima ACK: kedua sisi ESTABLISHED. Data kini boleh mengalir. Karena tiga pesan ini, kedua pihak sudah tahu nomor urut awal masing-masing.', 'ESTABLISHED', 'ESTABLISHED');
  return b.done();
}

export interface TransferOptions {
  /** Nomor urut byte pertama (x + 1 setelah handshake). */
  start: number;
  /** Ukuran tiap segmen data (byte). */
  sizes: number[];
  /** Indeks segmen (0-based) yang hilang pada pengiriman pertama, bila ada. */
  lose?: number;
}

export interface TransferRow {
  index: number;
  seq: number;
  len: number;
  /** Nomor ACK yang dikirim penerima untuk segmen ini; sama dengan sebelumnya berarti ACK ganda. */
  ack: number;
  lost: boolean;
  dupAck: boolean;
}

/** ACK TCP bersifat kumulatif: nomor byte berikutnya yang ditunggu. Segmen hilang membuat ACK ganda. */
export function transferTable({ start, sizes, lose }: TransferOptions): TransferRow[] {
  const rows: TransferRow[] = [];
  let seq = start;
  let expected = start;
  let prevAck = start; // ACK terakhir yang sudah dikirim penerima: SYN+ACK menunggu byte `start`
  for (let i = 0; i < sizes.length; i++) {
    const len = sizes[i];
    const lost = i === lose;
    if (!lost && seq === expected) expected = seq + len;
    // segmen hilang tidak menghasilkan ACK; segmen sesudahnya (di luar urutan) memicu ACK ganda berisi `expected`
    const ack = expected;
    rows.push({ index: i, seq, len, ack: lost ? NaN : ack, lost, dupAck: !lost && ack === prevAck });
    if (!lost) prevAck = ack;
    seq += len;
  }
  return rows;
}

export interface TeardownOptions {
  /** Nomor urut FIN klien (a) dan FIN server (b). */
  seqC: number;
  seqS: number;
}

/** 4-way teardown: FIN → ACK → FIN → ACK, lalu klien menunggu di TIME_WAIT. */
export function buildTeardown({ seqC: a, seqS: b }: TeardownOptions): ConnScenario {
  const bl = new Builder('ESTABLISHED', 'ESTABLISHED');
  let t = 0;
  let st = bl.step(t, `Klien selesai mengirim dan memanggil close(): ia mengirim FIN ($\\mathrm{seq}=${a}$) dan masuk FIN_WAIT_1.`, 'FIN_WAIT_1', 'ESTABLISHED');
  bl.seg('C', t, ['FIN'], a, undefined, 0, false, st);
  t += D;
  st = bl.step(t, `Server menerima FIN. Ia membalas ACK dengan $\\mathrm{ack}=${a + 1}$ (FIN menghabiskan satu nomor urut) dan masuk CLOSE_WAIT: aplikasinya mungkin masih punya data untuk dikirim.`, 'FIN_WAIT_1', 'CLOSE_WAIT');
  bl.seg('S', t, ['ACK'], b, a + 1, 0, false, st);
  t += D;
  bl.step(t, 'Klien menerima ACK dan menunggu FIN dari server (FIN_WAIT_2). Arah klien → server sudah tertutup; arah sebaliknya masih terbuka (half-close).', 'FIN_WAIT_2', 'CLOSE_WAIT');
  t += 1;
  st = bl.step(t, `Aplikasi server memanggil close(): server mengirim FIN ($\\mathrm{seq}=${b}$) dan masuk LAST_ACK.`, 'FIN_WAIT_2', 'LAST_ACK');
  bl.seg('S', t, ['FIN'], b, undefined, 0, false, st);
  t += D;
  st = bl.step(t, `Klien menerima FIN dan membalas ACK dengan $\\mathrm{ack}=${b + 1}$. Ia masuk TIME_WAIT: menunggu $2\\times\\mathrm{MSL}$ untuk berjaga-jaga bila ACK-nya hilang.`, 'TIME_WAIT', 'LAST_ACK');
  bl.seg('C', t, ['ACK'], a + 1, b + 1, 0, false, st);
  t += D;
  bl.step(t, 'Server menerima ACK terakhir dan langsung CLOSED.', 'TIME_WAIT', 'CLOSED');
  t += 3;
  bl.step(t, 'Setelah $2\\times\\mathrm{MSL}$, klien juga CLOSED. Koneksi benar-benar selesai.', 'CLOSED', 'CLOSED');
  return bl.done();
}
