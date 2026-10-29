import { useId } from 'react';
import { Rich } from './Rich';

export type SeqTone = 'data' | 'ack' | 'warn' | 'bad';

export interface SeqLane {
  id: string;
  /** Label di kepala garis hidup (boleh memuat `$…$`). */
  label: string;
}

export interface SeqMessage {
  id: string;
  from: string;
  to: string;
  /** Waktu kirim dan waktu tiba (satuan bebas, 0 … tMax). */
  t0: number;
  t1: number;
  /** Label di atas panah (boleh memuat `$…$`). */
  label: string;
  tone?: SeqTone;
  /** Pesan hilang di jalan: panah berhenti dan diberi tanda ✕. */
  lost?: boolean;
  /** Langkah simulasi saat pesan ini muncul. */
  step: number;
}

export interface SeqMark {
  lane: string;
  t: number;
  label: string;
  kind?: 'timer' | 'timeout' | 'note';
  step: number;
}

interface Props {
  lanes: SeqLane[];
  messages: SeqMessage[];
  marks?: SeqMark[];
  tMax: number;
  /** Langkah sekarang: hanya pesan/penanda dengan `step <= step` yang digambar. */
  step: number;
  /** Tinggi tetap (px). */
  height?: number;
  /** Tinggi kanvas (satuan viewBox); makin besar, jarak antar pesan makin lega. */
  viewHeight?: number;
  ariaLabel?: string;
}

const W = 560;
const DEFAULT_H = 420;
const TOP = 52;
const BOTTOM = 14;
const toneColor: Record<SeqTone, string> = {
  data: 'var(--c-check)',
  ack: 'var(--c-settled)',
  warn: 'var(--c-current)',
  bad: 'var(--c-bad)',
};

/** Diagram urutan waktu (waktu mengalir ke bawah) untuk pertukaran pesan antar node. */
/** Lebar kotak label: tidak melebihi jarak antar lajur, supaya teks tidak menimpa garis hidup. */
const labelW = (x0: number, ex: number) => Math.max(90, Math.min(230, Math.abs(ex - x0) - 12));
const labelX = (x0: number, ex: number) => {
  const w = labelW(x0, ex);
  const lo = Math.min(x0, ex) + 6;
  const hi = Math.max(x0, ex) - 6 - w;
  const center = x0 + (ex - x0) * 0.3 - w / 2;
  return hi >= lo ? Math.max(lo, Math.min(hi, center)) : center;
};

export function SeqDiagram({ lanes, messages, marks = [], tMax, step, height, viewHeight: H = DEFAULT_H, ariaLabel = 'Diagram urutan pesan' }: Props) {
  const uid = useId().replace(/:/g, '');
  const laneX = (id: string) => {
    const i = Math.max(0, lanes.findIndex((l) => l.id === id));
    return lanes.length === 1 ? W / 2 : 110 + (i * (W - 220)) / (lanes.length - 1);
  };
  const y = (t: number) => TOP + (t / Math.max(1, tMax)) * (H - TOP - BOTTOM);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="graph seq" role="img" aria-label={ariaLabel} style={height ? { height } : undefined}>
      <defs>
        {(Object.keys(toneColor) as SeqTone[]).map((t) => (
          <marker key={t} id={`${uid}-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={toneColor[t]} />
          </marker>
        ))}
      </defs>

      {lanes.map((l) => (
        <g key={l.id}>
          <foreignObject x={laneX(l.id) - 70} y={6} width={140} height={28}>
            <div className="seq-head">
              <Rich>{l.label}</Rich>
            </div>
          </foreignObject>
          <line x1={laneX(l.id)} x2={laneX(l.id)} y1={TOP - 12} y2={H - BOTTOM} stroke="var(--c-border)" strokeWidth={3} strokeLinecap="round" />
        </g>
      ))}

      {messages
        .filter((m) => m.step <= step)
        .map((m) => {
          const tone = m.tone ?? 'data';
          const x0 = laneX(m.from);
          const x1 = laneX(m.to);
          const y0 = y(m.t0);
          const y1 = y(m.t1);
          const frac = m.lost ? 0.58 : 1;
          const ex = x0 + (x1 - x0) * frac;
          const ey = y0 + (y1 - y0) * frac;
          const fresh = m.step === step;
          return (
            <g key={m.id} className={`seq-msg${fresh ? ' fresh' : ''}`}>
              <line
                x1={x0}
                y1={y0}
                x2={ex}
                y2={ey}
                stroke={toneColor[tone]}
                strokeWidth={3}
                strokeDasharray={m.lost ? '7 5' : undefined}
                markerEnd={m.lost ? undefined : `url(#${uid}-${tone})`}
              />
              {m.lost && (
                <path d={`M${ex - 7},${ey - 7} l14,14 m0,-14 l-14,14`} stroke="var(--c-bad)" strokeWidth={3.5} strokeLinecap="round" />
              )}
              {/* label dekat pangkal panah (sisi pengirim pesan), agar pesan yang berpapasan tidak saling menimpa */}
              <foreignObject x={labelX(x0, ex)} y={y0 + (ey - y0) * 0.3 - 24} width={labelW(x0, ex)} height={20}>
                <div className="seq-label" style={{ color: toneColor[tone] }}>
                  <Rich>{m.label}</Rich>
                </div>
              </foreignObject>
            </g>
          );
        })}

      {marks
        .filter((k) => k.step <= step)
        .map((k, i) => {
          const x = laneX(k.lane);
          const onRight = lanes.findIndex((l) => l.id === k.lane) > 0 || lanes.length === 1;
          const color = k.kind === 'timeout' ? 'var(--c-bad)' : k.kind === 'timer' ? 'var(--c-current)' : 'var(--c-text-muted)';
          return (
            <g key={i} className={`seq-mark${k.step === step ? ' fresh' : ''}`}>
              <circle cx={x} cy={y(k.t)} r={6} fill="var(--c-surface)" stroke={color} strokeWidth={3} />
              <foreignObject x={onRight ? x + 12 : x - 142} y={y(k.t) - 10} width={130} height={20}>
                <div className="seq-label" style={{ color, textAlign: onRight ? 'left' : 'right' }}>
                  <Rich>{k.label}</Rich>
                </div>
              </foreignObject>
            </g>
          );
        })}
    </svg>
  );
}
