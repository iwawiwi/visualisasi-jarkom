export type CellState = 'acked' | 'sent' | 'usable' | 'blocked' | 'received' | 'buffered' | 'lost';

interface Props {
  /** Nomor urut pertama yang ditampilkan dan jumlah sel. */
  from?: number;
  count: number;
  state: (seq: number) => CellState;
  /** Bingkai jendela: mulai (base) dan ukuran N. */
  window?: { base: number; size: number };
  /** Penunjuk di bawah sel, mis. `{ base: 2, nextseq: 5 }`. Label boleh berupa teks biasa. */
  pointers?: { seq: number; label: string }[];
  label?: string;
  /** Sisihkan ruang untuk sekian penunjuk bertumpuk agar tinggi tidak berubah saat penunjuk berpapasan. */
  reserveStack?: number;
  /** Teks pengganti untuk status tertentu (mis. sisi penerima: `blocked` = "belum diterima"). */
  stateText?: Partial<Record<CellState, string>>;
}

const text: Record<CellState, string> = {
  acked: 'sudah di-ACK',
  sent: 'terkirim, belum di-ACK',
  usable: 'boleh dikirim',
  blocked: 'belum boleh dikirim',
  received: 'diterima',
  buffered: 'ditahan di buffer',
  lost: 'hilang',
};

export const CELL_LEGEND: { state: CellState; label: string }[] = (Object.keys(text) as CellState[]).map((s) => ({ state: s, label: text[s] }));

/** Deret kotak nomor urut dengan bingkai jendela geser (Go-Back-N / Selective Repeat / flow control). */
export function WindowStrip({ from = 0, count, state, window: win, pointers = [], label, reserveStack = 0, stateText }: Props) {
  const say = (st: CellState) => stateText?.[st] ?? text[st];
  const CELL = 44;
  const GAP = 4;
  const x = (seq: number) => (seq - from) * (CELL + GAP);
  const width = count * (CELL + GAP) - GAP;
  return (
    <div className="winstrip" role="group" aria-label={label ?? 'Jendela nomor urut'}>
      {label && <div className="bitrow-label">{label}</div>}
      <div className="winstrip-track" style={{ width, height: 74 + 30 * Math.max(reserveStack, ...pointers.map((p, i) => pointers.slice(0, i).filter((q) => q.seq === p.seq).length)) }}>
        {win && (
          <div
            className="winstrip-frame"
            style={{ left: x(win.base) - 3, width: win.size * (CELL + GAP) - GAP + 6 }}
            aria-hidden="true"
          />
        )}
        {Array.from({ length: count }, (_, k) => {
          const seq = from + k;
          const st = state(seq);
          return (
            <div key={seq} className={`winstrip-cell st-${st}`} style={{ left: x(seq), width: CELL }} title={`${seq}: ${say(st)}`} role="img" aria-label={`Nomor ${seq}: ${say(st)}`}>
              {seq}
            </div>
          );
        })}
        {pointers.map((p, i) => (
          // penunjuk pada nomor urut yang sama ditumpuk ke bawah agar tidak saling menimpa
          <div key={p.label} className="winstrip-ptr" style={{ left: x(p.seq), top: 52 + 30 * pointers.slice(0, i).filter((q) => q.seq === p.seq).length }}>
            <span aria-hidden="true">▲</span>
            <span>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
