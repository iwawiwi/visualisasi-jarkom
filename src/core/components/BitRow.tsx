import { Fragment } from 'react';

export type BitRole = 'default' | 'network' | 'subnet' | 'host' | 'match' | 'mismatch' | 'error' | 'dim';

interface Props {
  /** Bit 0/1, panjang bebas (biasanya 8, 16, atau 32). */
  bits: number[];
  /** Peran warna tiap bit. */
  role?: (index: number) => BitRole;
  /** Membuat bit bisa diklik/dibalik (Enter/Spasi juga bekerja). */
  onToggle?: (index: number) => void;
  /** Garis batas sebelum bit ini (mis. panjang prefiks). */
  boundary?: number;
  /** Tampilkan nilai desimal di bawah tiap kelompok 8 bit. */
  octets?: boolean;
  /** Ukuran kelompok (bawaan 8). */
  group?: number;
  label?: string;
  ariaLabel?: string;
  /** `sm` untuk 32 bit dalam satu baris. */
  size?: 'md' | 'sm';
  /** Sembunyikan nilai desimal kelompok tertentu (mis. hasil yang belum diungkap). */
  showOctet?: (group: number) => boolean;
  /** Bit yang belum diungkap: tampil sebagai titik dan disembunyikan dari pembaca layar. */
  hidden?: (index: number) => boolean;
}

/** Deretan bit dalam kelompok oktet, dengan warna per peran dan garis batas prefiks. */
export function BitRow({ bits, role, onToggle, boundary, octets = false, group = 8, label, ariaLabel, size = 'md', showOctet, hidden }: Props) {
  const groups = Math.ceil(bits.length / group);
  return (
    <div className={`bitrow size-${size}`} role="group" aria-label={ariaLabel ?? label ?? 'Deretan bit'}>
      {label && <div className="bitrow-label">{label}</div>}
      <div className="bitrow-cells">
        {Array.from({ length: groups }, (_, g) => {
          const slice = bits.slice(g * group, (g + 1) * group);
          const value = slice.reduce((acc, b) => acc * 2 + b, 0);
          return (
            <Fragment key={g}>
              {g > 0 && <span className="bitrow-dot" aria-hidden="true">.</span>}
              <div className="bitrow-group">
                <div className="bitrow-bits">
                  {slice.map((b, k) => {
                    const i = g * group + k;
                    const r = role?.(i) ?? 'default';
                    const cls = `bit role-${r}${boundary === i && i < bits.length ? ' boundary' : ''}${onToggle ? ' clickable' : ''}`;
                    return onToggle ? (
                      <button key={i} type="button" className={cls} aria-label={`Bit ${i + 1}: ${b}`} onClick={() => onToggle(i)}>
                        {b}
                      </button>
                    ) : (
                      <span key={i} className={cls} aria-hidden={hidden?.(i) || undefined}>
                        {hidden?.(i) ? '·' : b}
                      </span>
                    );
                  })}
                </div>
                {octets && <div className="bitrow-dec">{showOctet && !showOctet(g) ? '·' : value}</div>}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
