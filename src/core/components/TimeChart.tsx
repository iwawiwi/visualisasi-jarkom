import { Rich } from './Rich';

export interface ChartSeries {
  label: string;
  /** Nama variabel CSS, mis. `var(--c-check)`. */
  color: string;
  /** Nilai per titik; `null` memutus garis. Sumbu-x = indeks, kecuali `xs` diberikan. */
  values: (number | null)[];
  xs?: number[];
  /** Garis tangga (nilai bertahan sampai titik berikutnya), mis. untuk jendela cwnd. */
  step?: boolean;
  dashed?: boolean;
}

export interface ChartMark {
  x: number;
  y: number;
  /** `loss` = tanda ✕ (paket hilang), `dot` = titik biasa. */
  kind?: 'loss' | 'dot';
  color?: string;
}

export interface ChartLine {
  y: number;
  /** Label (boleh memuat `$…$`). */
  label: string;
  color: string;
}

interface Props {
  series: ChartSeries[];
  xMax: number;
  yMax: number;
  /** Label sumbu (boleh memuat `$…$`). */
  xLabel?: string;
  yLabel?: string;
  /** Garis horizontal bertanda, mis. ambang `ssthresh`. */
  hLines?: ChartLine[];
  marks?: ChartMark[];
  /** Garis vertikal "sekarang" pada nilai x ini. */
  cursor?: number;
  yTicks?: number[];
  xTicks?: number[];
  ariaLabel?: string;
  /** Tinggi tetap (px) agar tata letak tidak bergeser. */
  height?: number;
  /** Tinggi kanvas (satuan viewBox); makin besar, grafik makin tinggi relatif terhadap lebarnya. */
  viewHeight?: number;
}

const W = 520;
const DEFAULT_H = 210;
const M = { l: 44, r: 14, t: 30, b: 34 };

/** Grafik garis ringan untuk nilai terhadap waktu/ronde. Semua warna dari variabel tema. */
export function TimeChart({ series, xMax, yMax, xLabel, yLabel, hLines = [], marks = [], cursor, yTicks, xTicks, ariaLabel = 'Grafik terhadap waktu', height, viewHeight: H = DEFAULT_H }: Props) {
  const yTop = yMax > 0 ? yMax : 1;
  const px = (x: number) => M.l + (x / Math.max(1, xMax)) * (W - M.l - M.r);
  const py = (v: number) => H - M.b - (Math.min(v, yTop) / yTop) * (H - M.t - M.b);
  const ys = yTicks ?? [...new Set([0, Math.round(yTop / 2), yTop])];

  const path = (s: ChartSeries) => {
    let d = '';
    let pen = false;
    s.values.forEach((v, i) => {
      const x = s.xs?.[i] ?? i;
      if (v === null) {
        pen = false;
        return;
      }
      if (!pen) d += `M${px(x)},${py(v)}`;
      else d += s.step ? ` H${px(x)} V${py(v)}` : ` L${px(x)},${py(v)}`;
      pen = true;
    });
    return d;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="graph" role="img" aria-label={ariaLabel} style={height ? { height } : undefined}>
      {ys.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={py(v)} y2={py(v)} stroke="var(--c-border)" />
          <text x={M.l - 6} y={py(v)} textAnchor="end" dominantBaseline="central" fontSize={12} fill="var(--c-text-muted)" fontFamily="var(--font-mono)">
            {v}
          </text>
        </g>
      ))}
      {xTicks?.map((v) => (
<text key={v} x={px(v) + (v === 0 ? 6 : 0)} y={H - M.b + 12} textAnchor={v === 0 ? 'start' : 'middle'} fontSize={12} fill="var(--c-text-muted)" fontFamily="var(--font-mono)">
          {v}
        </text>
      ))}
      {xLabel && (
        <foreignObject x={M.l} y={H - 18} width={W - M.l - M.r} height={18}>
          <div className="chart-label" style={{ textAlign: 'center' }}>
            <Rich>{xLabel}</Rich>
          </div>
        </foreignObject>
      )}
      {yLabel && (
        <foreignObject x={2} y={2} width={W - 4} height={18}>
          <div className="chart-label">
            <Rich>{yLabel}</Rich>
          </div>
        </foreignObject>
      )}
      {hLines.map((l) => (
        <g key={l.label}>
          <line x1={M.l} x2={W - M.r} y1={py(l.y)} y2={py(l.y)} stroke={l.color} strokeWidth={1.5} strokeDasharray="6 5" />
          <foreignObject x={W - M.r - 120} y={py(l.y) - 20} width={120} height={18}>
            <div className="chart-label" style={{ textAlign: 'right', color: l.color }}>
              <Rich>{l.label}</Rich>
            </div>
          </foreignObject>
        </g>
      ))}
      {cursor !== undefined && <line x1={px(cursor)} x2={px(cursor)} y1={M.t} y2={H - M.b} stroke="var(--c-text-muted)" strokeWidth={1} strokeDasharray="3 4" />}
      {series.map((s) => (
        <g key={s.label}>
          <path d={path(s)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeDasharray={s.dashed ? '7 5' : undefined} />
          {(() => {
            const last = s.values.length - 1;
            const v = s.values[last];
            return v === null || v === undefined ? null : <circle cx={px(s.xs?.[last] ?? last)} cy={py(v)} r={4.5} fill={s.color} />;
          })()}
        </g>
      ))}
      {marks.map((m, i) =>
        m.kind === 'loss' ? (
          <path
            key={i}
            d={`M${px(m.x) - 5},${py(m.y) - 5} l10,10 m0,-10 l-10,10`}
            stroke={m.color ?? 'var(--c-bad)'}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <circle key={i} cx={px(m.x)} cy={py(m.y)} r={4} fill={m.color ?? 'var(--c-current)'} />
        ),
      )}
    </svg>
  );
}
