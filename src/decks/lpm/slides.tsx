import { useState } from 'react';
import { type Protocol, type Route, AD, cidr, commonBits, lookup, matches, parseCidr } from '../../algorithms/lpm';
import { formatIp, maskOf, parseIp, toBits } from '../../algorithms/ipv4';
import { BitRow } from '../../core/components/BitRow';
import { Rich } from '../../core/components/Rich';
import { Tex } from '../../core/components/Tex';

const mk = (c: string, nextHop: string, protocol: Protocol = 'static', metric = 0): Route => {
  const p = parseCidr(c)!;
  return { prefix: p.network, len: p.len, nextHop, protocol, metric };
};
const ip = (s: string) => parseIp(s)!;

/* ---------- Slide 2: cocokkan bit demi bit ---------- */

const TABLE = [mk('0.0.0.0/0', '10.0.0.1'), mk('192.168.0.0/16', '10.0.0.2'), mk('192.168.1.0/24', '10.0.0.4'), mk('192.168.1.128/25', '10.0.0.3'), mk('192.168.1.192/27', '10.0.0.5')];
const DESTS = ['192.168.1.150', '192.168.1.50', '192.168.1.200', '192.168.7.7', '8.8.8.8'];

export function LpmLab() {
  const [text, setText] = useState('192.168.1.150');
  const [sel, setSel] = useState<number | null>(null);
  const dest = parseIp(text);
  const res = dest === null ? null : lookup(TABLE, dest);
  const winner = res?.best ? TABLE.indexOf(res.best) : -1;
  const shownIdx = sel ?? (winner >= 0 ? winner : 0);
  const route = TABLE[shownIdx];
  const destBits = dest === null ? Array(32).fill(0) : toBits(dest);
  const routeBits = toBits(route.prefix);
  const bitsSame = dest === null ? 0 : commonBits(dest, route.prefix);

  return (
    <div className="col">
      <div className="toolbar">
        <label className="muted" style={{ fontSize: 17 }}>
          Alamat tujuan:{' '}
          <input
            className="need-input"
            style={{ width: 150 }}
            value={text}
            aria-label="Alamat IP tujuan"
            aria-invalid={dest === null}
            onChange={(e) => {
              setText(e.target.value);
              setSel(null);
            }}
          />
        </label>
        {DESTS.map((d) => (
          <button
            key={d}
            className={`btn small${text === d ? ' active' : ''}`}
            onClick={() => {
              setText(d);
              setSel(null);
            }}
          >
            {d}
          </button>
        ))}
        {dest === null && <span style={{ color: 'var(--c-bad)', fontSize: 15 }}>Alamat IP tidak valid</span>}
      </div>
      <div className="card" style={{ padding: '10px 14px', display: 'grid', gap: 8 }}>
        <BitRow
          bits={destBits}
          size="sm"
          octets={false}
          label={`Alamat tujuan ${dest === null ? '' : formatIp(dest)}`}
          role={(i) => (i < route.len ? (destBits[i] === routeBits[i] ? 'match' : 'mismatch') : 'dim')}
          boundary={route.len}
        />
        <BitRow bits={routeBits.map((b, i) => (i < route.len ? b : 0))} size="sm" octets={false} label={`Rute ${cidr(route)}: hanya ${route.len} bit pertama yang dibandingkan`} role={(i) => (i < route.len ? 'network' : 'dim')} hidden={(i) => i >= route.len} />
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="col" style={{ width: 560, flex: 'none' }}>
          <div className="card" style={{ padding: 6 }}>
            <table className="algo fixed" aria-label="Tabel routing">
              <colgroup>
                <col style={{ width: 190 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className="left">Prefiks</th>
                  <th>Next hop</th>
                  <th>Bit sama</th>
                  <th>Cocok?</th>
                </tr>
              </thead>
              <tbody>
                {TABLE.map((rt, k) => {
                  const ok = dest !== null && matches(rt, dest);
                  return (
                    <tr key={cidr(rt)} className={`clickable${k === shownIdx ? ' selected' : ''}`} onClick={() => setSel(k)}>
                      <td className="left mono">
                        <button type="button" className="btn small" style={{ font: 'inherit', padding: '2px 8px' }} aria-pressed={k === shownIdx} aria-label={`Periksa rute ${cidr(rt)}`} onClick={() => setSel(k)}>
                          {cidr(rt)}
                        </button>
                      </td>
                      <td className="mono">{rt.nextHop}</td>
                      <td>{dest === null ? '' : commonBits(dest, rt.prefix)}</td>
                      <td className={k === winner ? 'chosen' : ok ? 'changed' : ''}>{dest === null ? '' : k === winner ? '✓ menang' : ok ? '✓ cocok' : '✗'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ fontSize: 15 }}>
            Klik sebuah baris untuk melihat perbandingan bitnya.
          </div>
        </div>
        <div className="col grow">
          <div className={`callout ${dest !== null && bitsSame >= route.len ? 'ok' : 'warn'}`} style={{ minHeight: 100 }} aria-live="polite">
            {dest === null ? (
              'Masukkan alamat IPv4 yang sah.'
            ) : bitsSame >= route.len ? (
              <>
                <b>
                  <Tex>{cidr(route)}</Tex> cocok:
                </b>{' '}
                <Tex>{String(route.len)}</Tex> bit pertama sama persis (alamat ini sama sampai <Tex>{String(bitsSame)}</Tex> bit).
              </>
            ) : (
              <>
                <b>
                  <Tex>{cidr(route)}</Tex> tidak cocok:
                </b>{' '}
                bit ke-<Tex>{String(bitsSame + 1)}</Tex> berbeda padahal dibutuhkan <Tex>{String(route.len)}</Tex> bit pertama sama.
              </>
            )}
          </div>
          <div className="callout" style={{ minHeight: 100 }}>
            {dest === null ? (
              <>Masukkan alamat IPv4 yang sah untuk melihat rute pemenang.</>
            ) : res?.best && res.matching.length === 1 ? (
              <>
                Hanya satu rute yang cocok: <Tex>{cidr(res.best)}</Tex> → next hop <Tex>{res.best.nextHop}</Tex>.
              </>
            ) : res?.best ? (
              <>
                Dari <b>{res.matching.length}</b> rute yang cocok, router memilih yang <b>prefiksnya terpanjang</b> (paling spesifik):{' '}
                <Tex>{cidr(res.best)}</Tex> → next hop <Tex>{res.best.nextHop}</Tex>.
              </>
            ) : (
              <>Tidak ada rute yang cocok dan tidak ada rute default: paket dibuang.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 3: garis alamat berlapis ---------- */

const LINE_BASE = ip('10.0.0.0');
const LINE_ROUTES = [mk('0.0.0.0/0', 'ISP'), mk('10.0.0.0/24', 'R-kantor'), mk('10.0.0.128/25', 'R-lantai2'), mk('10.0.0.192/27', 'R-lab'), mk('10.0.0.200/29', 'R-server')];
const COLORS = ['var(--ctp-overlay1)', 'var(--ctp-blue)', 'var(--ctp-green)', 'var(--ctp-peach)', 'var(--ctp-mauve)'];

export function AddressLine() {
  const [last, setLast] = useState(203);
  const [guess, setGuess] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const dest = LINE_BASE + last;
  const res = lookup(LINE_ROUTES, dest);
  const win = res.best ? LINE_ROUTES.indexOf(res.best) : -1;
  const solved = picked === win;
  const revealed = !guess || solved;
  const reset = () => {
    setPicked(null);
    setWrong([]);
  };
  const pick = (k: number) => {
    if (!guess || solved) return;
    setPicked(k);
    if (k !== win) setWrong((w) => (w.includes(k) ? w : [...w, k]));
  };

  return (
    <div className="col">
      <div className="toolbar">
        <label className="muted" style={{ fontSize: 17 }}>
          Alamat tujuan: <b className="mono" style={{ color: 'var(--c-text)' }}>10.0.0.{last}</b>{' '}
          <input
            type="range"
            data-prevent-swipe
            min={0}
            max={255}
            value={last}
            onChange={(e) => {
              setLast(Number(e.target.value));
              reset();
            }}
            aria-label="Oktet terakhir alamat tujuan"
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={guess}
            onChange={(e) => {
              setGuess(e.target.checked);
              reset();
            }}
          />
          Mode tebak dulu: klik rute yang akan dipilih router
        </label>
      </div>
      <div className="card" style={{ padding: '14px 16px' }}>
        <div role="group" aria-label="Rute-rute pada garis alamat" style={{ display: 'grid', gap: 6 }}>
          {LINE_ROUTES.map((rt, k) => {
            const covers = matches(rt, dest);
            const startPct = rt.len === 0 ? 0 : ((rt.prefix - LINE_BASE) / 256) * 100;
            const widthPct = rt.len === 0 ? 100 : ((2 ** (32 - rt.len)) / 256) * 100;
            const isWin = revealed && k === win;
            return (
              <button
                key={cidr(rt)}
                type="button"
                disabled={!guess || solved}
                onClick={() => pick(k)}
                aria-label={`Rute ${cidr(rt)} via ${rt.nextHop}${solved && k === win ? ', benar' : wrong.includes(k) ? ', salah' : ''}`}
                style={{ display: 'grid', gridTemplateColumns: '260px 1fr', alignItems: 'center', gap: 10, textAlign: 'left', border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: guess && !solved ? 'pointer' : 'default' }}
              >
                <span className="mono" style={{ fontSize: 15, fontWeight: isWin ? 800 : 500, color: isWin ? 'var(--c-settled)' : undefined }}>
                  {cidr(rt)} → {rt.nextHop}
                </span>
                <span style={{ position: 'relative', height: 30, border: '1.5px dashed var(--c-border)', borderRadius: 6, background: 'var(--c-surface)', outline: wrong.includes(k) ? '2.5px solid var(--c-bad)' : isWin ? '2.5px solid var(--c-settled)' : undefined }}>
                  <span style={{ position: 'absolute', left: `${startPct}%`, width: `${widthPct}%`, top: -1.5, bottom: -1.5, minWidth: 5, borderRadius: 6, border: `2px solid ${COLORS[k]}`, background: `color-mix(in srgb, ${COLORS[k]} ${revealed && covers ? 38 : 16}%, var(--c-surface))` }} />
                  {revealed && <span style={{ position: 'absolute', left: `${((last + 0.5) / 256) * 100}%`, top: -6, bottom: -6, width: 3, background: 'var(--c-primary)', marginLeft: -1 }} aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, paddingLeft: 270 }}>
          <span className="mono">10.0.0.0</span>
          <span>{revealed ? 'garis biru = alamat tujuan' : `alamat yang dicari: 10.0.0.${last}`}</span>
          <span className="mono">10.0.0.255</span>
        </div>
      </div>
      <div className={`callout ${solved ? 'ok' : ''}`} style={{ minHeight: 100 }} aria-live="polite">
        {guess && !solved ? (
          picked === null ? (
            <>Rute mana yang akan dipakai router untuk 10.0.0.{last}? Klik barisnya.</>
          ) : (
            <>
              Belum tepat. Cari rute yang mencakup alamat itu dengan <b>prefiks terpanjang</b> (bar paling sempit yang masih mengenai alamatnya).
            </>
          )
        ) : res.best ? (
          <>
            {guess && <b>Benar! </b>}
            <Rich>{`Rute yang mencakup $10.0.0.${last}$: ${res.matching.map((m) => `$${cidr(m)}$`).join(', ')}. Pemenangnya $${cidr(res.best)}$ via ${res.best.nextHop} karena prefiksnya terpanjang.`}</Rich>
          </>
        ) : (
          <>Tidak ada rute.</>
        )}
      </div>
    </div>
  );
}

/* ---------- Slide 4: AD dan metrik ---------- */

const AD_ROUTES: { id: number; route: Route; label: string }[] = [
  { id: 0, route: mk('10.20.0.0/16', '1.1.1.1', 'static', 0), label: 'Static' },
  { id: 1, route: mk('10.20.0.0/16', '2.2.2.2', 'ebgp', 100), label: 'eBGP' },
  { id: 2, route: mk('10.20.0.0/16', '3.3.3.3', 'ospf', 30), label: 'OSPF' },
  { id: 3, route: mk('10.20.0.0/16', '4.4.4.4', 'rip', 2), label: 'RIP' },
  { id: 4, route: mk('10.20.0.0/16', '6.6.6.6', 'ospf', 20), label: 'OSPF' },
  { id: 5, route: mk('10.20.5.0/24', '5.5.5.5', 'rip', 3), label: 'RIP' },
];

export function AdLab() {
  const [on, setOn] = useState<number[]>([0, 2, 3, 4, 5]);
  const [dest, setDest] = useState('10.20.5.9');
  const routes = AD_ROUTES.filter((r) => on.includes(r.id));
  const d = ip(dest);
  const res = lookup(
    routes.map((r) => r.route),
    d,
  );
  const stage1 = res.matching;
  const maxLen = stage1.length ? Math.max(...stage1.map((r) => r.len)) : 0;
  const stage2 = stage1.filter((r) => r.len === maxLen);
  const minAd = stage2.length ? Math.min(...stage2.map((r) => AD[r.protocol])) : 0;
  const stage3 = stage2.filter((r) => AD[r.protocol] === minAd);
  const label = (rt: Route) => AD_ROUTES.find((x) => x.route === rt)!.label;
  const REASON: Record<string, string> = {
    only: 'satu-satunya rute yang cocok',
    'longest-prefix': 'prefiks terpanjang',
    'admin-distance': 'Administrative Distance terkecil',
    metric: 'metrik terkecil',
    order: 'seri penuh: dipakai yang pertama',
    none: '',
  };

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="toolbar">
          <span className="muted">Tujuan:</span>
          <div className="seg" role="group" aria-label="Alamat tujuan">
            {['10.20.5.9', '10.20.9.9'].map((x) => (
              <button key={x} className={dest === x ? 'on' : ''} aria-pressed={dest === x} onClick={() => setDest(x)}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Kandidat rute">
            <thead>
              <tr>
                <th>Ada</th>
                <th className="left">Sumber</th>
                <th>Prefiks</th>
                <th>AD</th>
                <th>Metrik</th>
              </tr>
            </thead>
            <tbody>
              {AD_ROUTES.map((r) => {
                const enabled = on.includes(r.id);
                const isBest = res.best === r.route;
                return (
                  <tr key={r.id} className={isBest ? 'live' : ''} style={{ opacity: enabled ? 1 : 0.45 }}>
                    <td>
                      <input type="checkbox" checked={enabled} aria-label={`Sertakan rute ${r.label} ${cidr(r.route)}`} onChange={() => setOn((a) => (a.includes(r.id) ? a.filter((x) => x !== r.id) : [...a, r.id]))} />
                    </td>
                    <td className="left">
                      {r.label} <span className="muted mono" style={{ fontSize: 12 }}>via {r.route.nextHop}</span>
                    </td>
                    <td className="mono">{cidr(r.route)}</td>
                    <td>{AD[r.route.protocol]}</td>
                    <td>{r.route.protocol === 'static' ? '—' : r.route.metric}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 14 }}>
          AD bawaan: connected 0, static 1, eBGP 20, OSPF 110, RIP 120, iBGP 200.
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ fontSize: 18 }}>
          <div>
            <b>1. Prefiks terpanjang</b>: {stage1.length} cocok → tersisa <b>{stage2.length}</b>
          </div>
          <div style={{ marginTop: 6 }}>
            <b>2. AD terkecil</b>: tersisa <b>{stage3.length}</b>
          </div>
          <div style={{ marginTop: 6 }}>
            <b>3. Metrik terkecil</b>: {res.best ? '1 pemenang' : '—'}
          </div>
        </div>
        <div className={`callout ${res.best ? 'ok' : 'bad'}`} style={{ minHeight: 140 }} aria-live="polite">
          {res.best ? (
            <>
              Pemenang: <b>{label(res.best)}</b> <Tex>{cidr(res.best)}</Tex> via <Tex>{res.best.nextHop}</Tex>. Dipilih karena <b>{REASON[res.reason]}</b>.
            </>
          ) : (
            <>Tidak ada rute yang cocok untuk {dest}.</>
          )}
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Urutan penting: prefiks dibandingkan <i>lebih dulu</i>. Rute /24 dari RIP mengalahkan rute /16 statis, walau AD static lebih baik. AD hanya membandingkan sumber untuk{' '}
          <i>prefiks yang sama</i>; metrik hanya sesama protokol.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 5: sandbox ---------- */

const SB_DEFAULT = [mk('0.0.0.0/0', '10.0.0.1'), mk('172.16.0.0/12', '10.0.0.2'), mk('172.16.8.0/21', '10.0.0.3')];

export function RouteSandbox() {
  const [routes, setRoutes] = useState<Route[]>(SB_DEFAULT);
  const [cidrText, setCidrText] = useState('172.16.9.0/24');
  const [hop, setHop] = useState('10.0.0.4');
  const [dest, setDest] = useState('172.16.9.20');
  const parsed = parseCidr(cidrText);
  const d = parseIp(dest);
  const res = d === null ? null : lookup(routes, d);
  const dup = parsed && routes.some((r) => r.prefix === parsed.network && r.len === parsed.len);
  const hopOk = parseIp(hop) !== null;
  const err =
    cidrText.trim() === ''
      ? ''
      : !parsed
        ? 'Format salah, atau bit host tidak nol (mis. 172.16.9.5/24 → tulis 172.16.9.0/24)'
        : dup
          ? 'Prefiks ini sudah ada'
          : !hopOk
            ? 'Next hop harus alamat IPv4, mis. 10.0.0.4'
            : routes.length >= 8
              ? 'Tabel penuh (maksimal 8 rute)'
              : '';

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 600, flex: 'none' }}>
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Tabel routing sandbox">
            <thead>
              <tr>
                <th className="left">Prefiks</th>
                <th>Next hop</th>
                <th>Hasil</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }, (_, k) => {
                const rt = routes[k];
                if (!rt)
                  return (
                    <tr key={k} aria-hidden="true">
                      <td colSpan={4} />
                    </tr>
                  );
                const ok = d !== null && matches(rt, d);
                const isBest = res?.best === rt;
                return (
                  <tr key={cidr(rt)} className={isBest ? 'live' : ''}>
                    <td className="left mono">{cidr(rt)}</td>
                    <td className="mono">{rt.nextHop}</td>
                    <td className={isBest ? 'chosen' : ok ? 'changed' : ''}>{isBest ? '✓ menang' : ok ? 'cocok' : ''}</td>
                    <td>
                      <button className="btn small" aria-label={`Hapus rute ${cidr(rt)}`} onClick={() => setRoutes((a) => a.filter((x) => x !== rt))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ padding: 10 }}>
          <div className="toolbar">
            <input className="need-input" style={{ width: 170 }} value={cidrText} aria-label="Prefiks CIDR rute baru" aria-invalid={!!err} onChange={(e) => setCidrText(e.target.value)} />
            <input className="need-input" style={{ width: 120 }} value={hop} aria-label="Next hop rute baru" onChange={(e) => setHop(e.target.value)} />
            <button className="btn primary" disabled={!parsed || !!dup || routes.length >= 8 || !hopOk} onClick={() => setRoutes((a) => [...a, { prefix: parsed!.network, len: parsed!.len, nextHop: formatIp(parseIp(hop)!), protocol: 'static', metric: 0 }])}>
              + Tambah rute
            </button>
            <button className="btn small" onClick={() => setRoutes(SB_DEFAULT)}>
              ⟲ Awal
            </button>
          </div>
          <div style={{ color: 'var(--c-bad)', fontSize: 14, minHeight: 20 }} role="status">
            {err}
          </div>
        </div>
      </div>
      <div className="col grow">
        <label className="muted" style={{ fontSize: 17 }}>
          Alamat tujuan:{' '}
          <input className="need-input" style={{ width: 150 }} value={dest} aria-label="Alamat IP tujuan" aria-invalid={d === null} onChange={(e) => setDest(e.target.value)} />
        </label>
        <div className={`callout ${res?.best ? 'ok' : 'bad'}`} style={{ minHeight: 150 }} aria-live="polite">
          {d === null ? (
            'Alamat tujuan tidak valid.'
          ) : res?.best ? (
            <>
              <Tex>{dest}</Tex> cocok dengan <b>{res.matching.length}</b> rute. Pemenang: <Tex>{cidr(res.best)}</Tex> → <span className="mono">{res.best.nextHop}</span>
              {res.matching.length > 1 && <> (prefiks terpanjang, <Tex>{`/${res.best.len}`}</Tex>)</>}.
            </>
          ) : (
            <>Tidak ada rute yang cocok dan tidak ada rute default (0.0.0.0/0): paket dibuang.</>
          )}
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Coba hapus rute default, atau tambah <span className="mono">172.16.9.16/28</span>.{res?.best && <> Mask rute pemenang: <Tex>{formatIp(maskOf(res.best.len))}</Tex>.</>}
        </div>
      </div>
    </div>
  );
}
