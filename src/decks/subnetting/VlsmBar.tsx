import { type Alloc, formatIp } from '../../algorithms/ipv4';

const COLORS = ['var(--ctp-blue)', 'var(--ctp-green)', 'var(--ctp-peach)', 'var(--ctp-mauve)', 'var(--ctp-teal)', 'var(--ctp-yellow)'];
export const blockColor = (i: number) => COLORS[i % COLORS.length];

interface Props {
  /** Blok induk. */
  parent: { network: number; size: number };
  allocs: Alloc[];
  /** Hanya `visible` alokasi pertama yang digambar (untuk animasi langkah demi langkah). */
  visible?: number;
  /** Alokasi yang sedang disorot. */
  active?: number;
  ariaLabel?: string;
}

/** Batang alamat: lebar sebanding dengan jumlah alamat, blok berwarna per alokasi, sisa ruang bergaris putus. */
export function VlsmBar({ parent, allocs, visible = allocs.length, active, ariaLabel = 'Pembagian blok alamat' }: Props) {
  const shown = allocs.slice(0, visible);
  const pct = (n: number) => `${(n / parent.size) * 100}%`;
  return (
    <div className="vlsm-bar" role="img" aria-label={ariaLabel}>
      {shown.map((a, i) => (
        <div
          key={a.info.network}
          className={`vlsm-block${active === i ? ' active' : ''}`}
          style={{ left: pct(a.info.network - parent.network), width: pct(a.info.size), ['--blk' as string]: blockColor(i) }}
          title={`${a.need.name}: ${formatIp(a.info.network)}/${a.prefix}`}
        >
          {a.info.size / parent.size >= 0.06 && <span>/{a.prefix}</span>}
        </div>
      ))}
      <div className="vlsm-ends" aria-hidden="true">
        <span>{formatIp(parent.network)}</span>
        <span>{formatIp(parent.network + parent.size - 1)}</span>
      </div>
    </div>
  );
}
