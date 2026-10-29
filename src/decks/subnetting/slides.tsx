import { useMemo, useRef, useState } from 'react';
import {
  type Alloc,
  type Need,
  allocateVlsm,
  blockSize,
  blocksIn,
  flsm,
  formatIp,
  fromBits,
  maskOf,
  networkOf,
  parseIp,
  prefixForHosts,
  subnetInfo,
  toBits,
  usableHosts,
} from '../../algorithms/ipv4';
import { BitRow } from '../../core/components/BitRow';
import { GuessCard } from '../../core/components/GuessCard';
import { Rich } from '../../core/components/Rich';
import { StepControls } from '../../core/components/StepControls';
import { Tex } from '../../core/components/Tex';
import { useFragmentStepper } from '../../core/hooks/useFragmentStepper';
import { makeRng } from '../../core/rng';
import { VlsmBar, blockColor } from './VlsmBar';

const ip = (s: string) => parseIp(s)!;
const blk = (a: Alloc) => `${formatIp(a.info.network)}/${a.prefix}`;
const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];

/* ---------- Slide 2: biner ↔ desimal ---------- */

const IP_EXAMPLES = ['172.16.50.126', '192.168.1.50', '10.0.0.1'];

export function BitLab() {
  const [bits, setBits] = useState(() => toBits(ip(IP_EXAMPLES[0])));
  const [oct, setOct] = useState(3);
  const slice = bits.slice(oct * 8, oct * 8 + 8);
  const value = fromBits(slice);
  const terms = WEIGHTS.filter((_, i) => slice[i] === 1);

  return (
    <div className="col">
      <div className="card" style={{ padding: '14px 18px' }}>
        <BitRow
          bits={bits}
          octets
          label="Klik bit untuk membalik (0 ↔ 1)"
          role={(i) => (Math.floor(i / 8) === oct ? 'network' : 'default')}
          onToggle={(i) => setBits((b) => b.map((x, k) => (k === i ? 1 - x : x)))}
        />
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="col grow">
          <div className="toolbar">
            <span className="muted">Lihat oktet:</span>
            <div className="seg" role="group" aria-label="Pilih oktet">
              {[0, 1, 2, 3].map((o) => (
                <button key={o} className={oct === o ? 'on' : ''} aria-pressed={oct === o} onClick={() => setOct(o)}>
                  {o + 1}
                </button>
              ))}
            </div>
            <span className="muted">Contoh:</span>
            {IP_EXAMPLES.map((e) => (
              <button key={e} className="btn small" onClick={() => setBits(toBits(ip(e)))}>
                {e}
              </button>
            ))}
          </div>
          <div className="card">
            <div className="muted" style={{ fontSize: 15, marginBottom: 6 }}>
              Nilai tiap posisi bit (dari kiri ke kanan)
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {WEIGHTS.map((w, i) => (
                <div key={w} style={{ width: 54, textAlign: 'center' }}>
                  <div className="mono muted" style={{ fontSize: 17 }}>
                    {w}
                  </div>
                  <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: slice[i] ? 'var(--c-settled)' : 'var(--c-text-muted)' }}>
                    {slice[i]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col grow">
          <div className="card" style={{ minHeight: 150 }}>
            <div className="muted" style={{ fontSize: 15 }}>
              Oktet ke-{oct + 1}: jumlahkan nilai posisi yang berbit 1
            </div>
            <div style={{ fontSize: 26, margin: '8px 0' }}>
              <Tex>{`${terms.length ? terms.join('+') : '0'}=${value}`}</Tex>
            </div>
            <div className="muted" style={{ fontSize: 15 }}>
              Alamat lengkap (notasi titik-desimal)
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--c-current)' }}>
              <Tex>{formatIp(fromBits(bits))}</Tex>
            </div>
          </div>
          <div className="callout">
            Satu oktet = 8 bit, jadi nilainya <b>0 – 255</b>. Alamat IPv4 = 4 oktet = 32 bit.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 3: porsi network vs host ---------- */

export function PrefixLab() {
  const [prefix, setPrefix] = useState(26);
  const addr = ip('192.168.1.50');
  const bits = toBits(addr);
  const s = subnetInfo(addr, prefix);
  const hostBits = 32 - prefix;

  return (
    <div className="col">
      <div className="card" style={{ padding: '14px 18px' }}>
        <BitRow
          bits={bits}
          octets
          boundary={prefix}
          label="Alamat 192.168.1.50: biru = bagian network, hijau = bagian host"
          role={(i) => (i < prefix ? 'network' : 'host')}
        />
      </div>
      <div className="toolbar">
        <label className="muted" style={{ fontSize: 17 }}>
          Panjang prefiks: <b style={{ color: 'var(--c-text)' }}>/{prefix}</b>{' '}
          <input type="range" data-prevent-swipe min={0} max={32} value={prefix} onChange={(e) => setPrefix(Number(e.target.value))} aria-label="Panjang prefiks" />
        </label>
        <span className="muted">Kelas lama:</span>
        {[8, 16, 24].map((p) => (
          <button key={p} className="btn small" onClick={() => setPrefix(p)}>
            /{p}
          </button>
        ))}
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card col grow" style={{ minHeight: 190 }}>
          <div style={{ fontSize: 20 }}>
            Mask: <Tex>{formatIp(s.mask)}</Tex>
          </div>
          <div style={{ fontSize: 20, marginTop: 6 }}>
            Bit network <Tex>{String(prefix)}</Tex>, bit host <Tex>{String(hostBits)}</Tex>
          </div>
          <div style={{ fontSize: 20, marginTop: 6 }}>
            Alamat per blok: <Tex>{`2^{${hostBits}}=${s.size.toLocaleString('id-ID')}`}</Tex>
          </div>
          <div style={{ fontSize: 20, marginTop: 6 }}>
            Host yang bisa dipakai: <Tex>{prefix >= 31 ? String(s.hosts) : `2^{${hostBits}}-2=${s.hosts.toLocaleString('id-ID')}`}</Tex>
          </div>
        </div>
        <div className="col grow">
          <div className="callout" style={{ minHeight: 110 }}>
            {prefix === 8 || prefix === 16 || prefix === 24 ? (
              <>
                <b>Classful:</b> dulu prefiks hanya boleh /8, /16, atau /24. Butuh 500 host? Terpaksa memakai /16 yang berisi{' '}
                <Tex>{'65.534'}</Tex> host: sangat boros.
              </>
            ) : (
              <>
                <b>CIDR:</b> prefiks boleh berapa saja. Geser ke kanan: blok makin kecil, subnet makin banyak, host per subnet makin sedikit.
              </>
            )}
          </div>
          {prefix >= 31 && (
            <div className="callout warn">
              <Rich>{prefix === 31 ? '$/31$ khusus link titik-ke-titik (RFC 3021): 2 alamat dan keduanya dipakai. Di latihan VLSM kita memakai $/30$, cara klasik.' : '$/32$ = satu alamat saja (rute ke satu host).'}</Rich>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 4: IP AND mask = network ---------- */

const AND_EXAMPLES = [
  { ip: '162.148.139.126', p: 26 },
  { ip: '192.168.1.70', p: 27 },
  { ip: '10.45.200.9', p: 20 },
];

export function AndLab() {
  const [k, setK] = useState(0);
  const ex = AND_EXAMPLES[k];
  const addr = ip(ex.ip);
  const mask = maskOf(ex.p);
  const net = networkOf(addr, ex.p);
  const s = useFragmentStepper(6, 1400);
  const shown = s.index; // 1..4 = jumlah oktet yang sudah diungkap; 5 = ringkasan
  const octs = Math.min(shown, 4);

  const oct = (n: number, o: number) => (n >>> (24 - 8 * o)) & 255;
  let explain: string;
  if (shown === 0) explain = 'Router membandingkan alamat dengan mask bit demi bit. Hasil AND bernilai $1$ hanya bila kedua bit bernilai $1$.';
  else if (shown <= 4) {
    const a = oct(addr, shown - 1);
    const m = oct(mask, shown - 1);
    const r = oct(net, shown - 1);
    const why = m === 255 ? 'mask penuh: oktet tidak berubah.' : m === 0 ? 'mask nol: semua bit host menjadi $0$.' : 'mask sebagian: bit host di oktet ini menjadi $0$.';
    explain = `Oktet $${shown}$: $${a}\\ \\mathrm{AND}\\ ${m}=${r}$, ${why}`;
  } else explain = `Alamat network: $${formatIp(net)}$. Semua bit host dijadikan $0$; inilah yang dicocokkan dengan tabel routing.`;

  return (
    <div className="col">
      <div className="toolbar">
        <span className="muted">Contoh:</span>
        <div className="seg" role="group" aria-label="Pilih contoh">
          {AND_EXAMPLES.map((e, i) => (
            <button
              key={e.ip}
              className={k === i ? 'on' : ''}
              aria-pressed={k === i}
              onClick={() => {
                setK(i);
                s.reset();
              }}
            >
              {e.ip}/{e.p}
            </button>
          ))}
        </div>
      </div>
      {s.fragments}
      <div className="card" style={{ padding: '12px 18px', display: 'grid', gap: 10 }}>
        <BitRow bits={toBits(addr)} octets size="sm" label="Alamat IP" role={(i) => (i < ex.p ? 'network' : 'host')} />
        <BitRow bits={toBits(mask)} octets size="sm" label={`Mask /${ex.p}`} role={(i) => (i < ex.p ? 'network' : 'default')} />
        <BitRow
          bits={toBits(net).map((b, i) => (i < octs * 8 ? b : 0))}
          octets
          size="sm"
          label="Hasil AND = alamat network"
          showOctet={(g) => g < octs}
          hidden={(i) => i >= octs * 8}
          role={(i) => (i >= octs * 8 ? 'dim' : toBits(net)[i] === 1 ? 'match' : 'default')}
        />
      </div>
      <div className="explain" aria-live="polite">
        <Rich>{explain}</Rich>
      </div>
      <StepControls s={s} unit="Langkah" />
    </div>
  );
}

/* ---------- Slide 5: di blok mana IP ini? ---------- */

const BASE = ip('192.168.1.0');

export function BlockFinder() {
  const [prefix, setPrefix] = useState(27);
  const [last, setLast] = useState(70);
  const [guess, setGuess] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const addr = BASE + last;
  const blocks = blocksIn(BASE, 24, prefix);
  const correct = networkOf(addr, prefix);
  const info = subnetInfo(addr, prefix);
  const solved = picked === correct;
  const revealed = !guess || solved;

  const reset = () => {
    setPicked(null);
    setWrong([]);
  };
  const pick = (b: number) => {
    if (!guess || solved) return;
    setPicked(b);
    if (b !== correct) setWrong((w) => (w.includes(b) ? w : [...w, b]));
  };

  return (
    <div className="col">
      <div className="toolbar">
        <label className="muted" style={{ fontSize: 17 }}>
          Alamat: <b className="mono" style={{ color: 'var(--c-text)' }}>192.168.1.{last}</b>{' '}
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
            aria-label="Oktet terakhir alamat IP"
          />
        </label>
        <label className="muted" style={{ fontSize: 17 }}>
          Prefiks:{' '}
          <select
            aria-label="Panjang prefiks"
            value={prefix}
            onChange={(e) => {
              setPrefix(Number(e.target.value));
              reset();
            }}
          >
            {[25, 26, 27, 28, 29].map((p) => (
              <option key={p} value={p}>
                /{p} ({blockSize(p)} alamat per blok)
              </option>
            ))}
          </select>
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
          Mode tebak dulu
        </label>
      </div>

      <div className="card" style={{ padding: '22px 18px 14px' }}>
        <div className="blkfind" role="group" aria-label="Blok-blok alamat">
          {blocks.map((b) => {
            const has = networkOf(addr, prefix) === b;
            const cls = `blk${revealed && has ? ' has-ip' : ''}${solved && has ? ' right' : ''}${wrong.includes(b) ? ' wrong' : ''}`;
            return (
              <button
                key={b}
                className={cls}
                style={{ left: `${((b - BASE) / 256) * 100}%`, width: `${(blockSize(prefix) / 256) * 100}%` }}
                onClick={() => pick(b)}
                aria-label={`Blok mulai .${b - BASE}${solved && has ? ', benar' : wrong.includes(b) ? ', salah' : ''}`}
              >
                <span>{b - BASE}</span>
              </button>
            );
          })}
          {revealed && <div className="ipmark" style={{ left: `${((last + 0.5) / 256) * 100}%` }} aria-hidden="true" />}
        </div>
        <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="mono">192.168.1.0</span>
          <span>{revealed ? `garis biru = alamat 192.168.1.${last}` : `alamat yang dicari: 192.168.1.${last}`}</span>
          <span className="mono">192.168.1.255</span>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card col grow detail-card" style={{ height: 170 }} aria-live="polite">
          {revealed ? (
            <>
              <div style={{ fontSize: 20 }}>
                Network: <Tex>{formatIp(info.network)}</Tex> · Broadcast: <Tex>{formatIp(info.broadcast)}</Tex>
              </div>
              <div style={{ fontSize: 20, marginTop: 6 }}>
                Host: <Tex>{formatIp(info.first)}</Tex> sampai <Tex>{formatIp(info.last)}</Tex>
              </div>
              <div style={{ fontSize: 20, marginTop: 6 }}>
                Jumlah host: <Tex>{`2^{${32 - prefix}}-2=${info.hosts}`}</Tex>
              </div>
            </>
          ) : (
            <span className="muted" style={{ fontSize: 19 }}>
              {picked === null ? (
                <>
                  Klik blok yang menurutmu memuat <b className="mono">192.168.1.{last}</b>.
                </>
              ) : (
                <>
                  Belum tepat: <b className="mono">192.168.1.{last}</b> bukan di blok yang dimulai .{picked - BASE}. Alamat network sebuah blok selalu kelipatan <Tex>{String(blockSize(prefix))}</Tex>.
                </>
              )}
            </span>
          )}
        </div>
        <div className="callout grow" style={{ minHeight: 120 }}>
          {solved ? (
            <>
              <b>Benar!</b> <Rich>{`$${last}$ berada di blok yang dimulai $${info.network - BASE}$ dan berakhir $${info.broadcast - BASE}$.`}</Rich>
            </>
          ) : (
            <>
              Cara cepat: bagi oktet terakhir dengan ukuran blok (<Tex>{String(blockSize(prefix))}</Tex>), buang sisanya, lalu kalikan lagi. Untuk{' '}
              <Tex>{String(last)}</Tex>: <Tex>{`\\lfloor ${last}/${blockSize(prefix)}\\rfloor\\times ${blockSize(prefix)}=${revealed ? info.network - BASE : '\\,?'}`}</Tex>.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 6: FLSM vs VLSM ---------- */

const PARENT = { network: ip('192.168.10.0'), prefix: 24 };
const COMPARE_NEEDS: Need[] = [
  { name: 'Gedung Pusat', hosts: 100 },
  { name: 'Kantor Cabang', hosts: 50 },
  { name: 'Router P2P', hosts: 2 },
];

export function VlsmCompare() {
  const [mode, setMode] = useState<'flsm' | 'vlsm'>('flsm');
  const vlsm = useMemo(() => allocateVlsm(PARENT, COMPARE_NEEDS), []);
  const fl = useMemo(() => flsm(PARENT, COMPARE_NEEDS), []);
  const flAllocs: Alloc[] = useMemo(
    () =>
      blocksIn(PARENT.network, PARENT.prefix, fl.prefix!)
        .slice(0, COMPARE_NEEDS.length)
        .map((b, i) => {
          const info = subnetInfo(b, fl.prefix!);
          return { need: COMPARE_NEEDS[i], prefix: fl.prefix!, info, wasted: info.hosts - COMPARE_NEEDS[i].hosts };
        }),
    [fl],
  );
  const allocs = mode === 'flsm' ? flAllocs : vlsm.allocs;
  const unplaced = COMPARE_NEEDS.slice(allocs.length);
  const used = allocs.reduce((s, a) => s + a.info.size, 0);

  return (
    <div className="col">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Metode pembagian">
          <button className={mode === 'flsm' ? 'on' : ''} aria-pressed={mode === 'flsm'} onClick={() => setMode('flsm')}>
            FLSM: semua subnet sama besar
          </button>
          <button className={mode === 'vlsm' ? 'on' : ''} aria-pressed={mode === 'vlsm'} onClick={() => setMode('vlsm')}>
            VLSM: sesuai kebutuhan
          </button>
        </div>
        <span className="muted">
          Blok induk <b className="mono">192.168.10.0/24</b> (256 alamat)
        </span>
      </div>
      <div className="card" style={{ padding: '18px 18px 10px' }}>
        <VlsmBar parent={{ network: PARENT.network, size: 256 }} allocs={allocs} />
      </div>
      <div className="card" style={{ padding: 6 }}>
        <table className="algo fixed" aria-label="Pembagian blok">
          <thead>
            <tr>
              <th className="left">Subnet</th>
              <th>Host diminta</th>
              <th>Blok</th>
              <th>Host tak terpakai</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_NEEDS.map((n, i) => {
              const a = allocs.find((x) => x.need.name === n.name);
              return (
                <tr key={n.name}>
                  <td className="left">
                    <span style={{ color: a ? blockColor(i) : undefined }}>■ </span>
                    {n.name}
                  </td>
                  <td>{n.hosts}</td>
                  <td className={a ? 'mono' : 'changed'}>{a ? blk(a) : 'tidak muat'}</td>
                  <td>{a ? a.wasted : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={`callout ${mode === 'vlsm' ? 'ok' : 'bad'}`} style={{ minHeight: 96 }}>
        {mode === 'flsm' ? (
          <>
            Semua subnet harus muat <b><Tex>100</Tex> host</b>, jadi semuanya <b><Tex>{`/${fl.prefix}`}</Tex></b> (<Tex>{String(fl.size)}</Tex> alamat). Induk hanya memuat{' '}
            <Tex>{String(fl.capacity)}</Tex> blok, padahal butuh <Tex>3</Tex>: <b>{unplaced.map((u) => u.name).join(', ')} tidak kebagian</b>. Jaringan kecil pun menghabiskan <Tex>128</Tex> alamat.
          </>
        ) : (
          <>
            Tiap subnet diberi blok seukuran kebutuhannya. Terpakai <Tex>{String(used)}</Tex> dari <Tex>256</Tex> alamat, sisa <Tex>{String(vlsm.freeAddresses)}</Tex> masih bebas untuk
            subnet baru.
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Slide 7: VLSM langkah demi langkah ---------- */

const STEP_NEEDS: Need[] = [
  { name: 'Router P2P', hosts: 2 },
  { name: 'Gedung Pusat', hosts: 100 },
  { name: 'Kantor Cabang', hosts: 50 },
];

function prefixOptions(correct: number, seed: number): number[] {
  const min = Math.max(0, correct - 3);
  const lo = min + makeRng(seed).int(Math.min(correct, 27) - min + 1);
  return [0, 1, 2, 3].map((k) => lo + k);
}

export function VlsmSteps() {
  const res = useMemo(() => allocateVlsm(PARENT, STEP_NEEDS), []);
  const n = res.allocs.length;
  const [predict, setPredict] = useState(false);
  const [score, setScore] = useState({ ok: 0, all: 0 });
  const limitRef = useRef<number | undefined>(undefined);
  const s = useFragmentStepper(n + 3, 1500, limitRef);
  const i = s.index;
  const allocIdx = i - 2; // alokasi yang baru dikerjakan pada langkah ini
  const placed = Math.max(0, Math.min(n, allocIdx + 1));
  const nextAlloc = i + 1 >= 2 && i + 1 <= n + 1 ? res.allocs[i - 1] : undefined;
  const needGuess = predict && !!nextAlloc;
  limitRef.current = needGuess ? i : undefined;

  const rows = i === 0 ? STEP_NEEDS : res.order;
  let explain: string;
  if (i === 0) explain = 'Tiga kebutuhan datang dalam urutan sembarang. Langkah pertama: urutkan dari yang terbesar supaya blok besar ditempatkan lebih dulu.';
  else if (i === 1) explain = 'Terurut dari host terbanyak: $100$, $50$, lalu $2$. Sekarang beri tiap kebutuhan blok terkecil yang cukup.';
  else if (allocIdx < n) {
    const a = res.allocs[allocIdx];
    const hb = 32 - a.prefix;
    const small = a.prefix < 30 ? ` $2^{${hb - 1}}-2=${usableHosts(a.prefix + 1)}$ terlalu kecil,` : '';
    explain = `${a.need.name}: butuh $${a.need.hosts}$ host.${small} $2^{${hb}}-2=${a.info.hosts}\\ge ${a.need.hosts}$ cukup, jadi prefiks $/${a.prefix}$. Blok: $${blk(a)}$ (host $${formatIp(a.info.first)}$–$${formatIp(a.info.last)}$).`;
  } else explain = `Selesai tanpa celah. Alamat bebas mulai $${formatIp(res.freeFrom)}$ ($${res.freeAddresses}$ alamat) untuk subnet berikutnya.`;

  return (
    <div className="col">
      {s.fragments}
      <div className="card" style={{ padding: '18px 18px 10px' }}>
        <VlsmBar parent={{ network: PARENT.network, size: 256 }} allocs={res.allocs} visible={placed} active={allocIdx < n ? allocIdx : undefined} />
      </div>
      <div className="card" style={{ padding: 6 }}>
        <table className="algo fixed" aria-label="Kebutuhan dan alokasi">
          <thead>
            <tr>
              <th className="left">Subnet</th>
              <th>Host diminta</th>
              <th>Prefiks</th>
              <th>Blok</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => {
              const a = i >= 2 ? res.allocs[k] : undefined;
              const done = !!a && k < placed;
              return (
                <tr key={r.name} className={a && k === allocIdx ? 'live' : ''}>
                  <td className="left">
                    <span style={{ color: done ? blockColor(k) : undefined }}>■ </span>
                    {r.name}
                  </td>
                  <td>{r.hosts}</td>
                  <td className="mono">{done ? `/${a!.prefix}` : ''}</td>
                  <td className="mono">{done ? blk(a!) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="explain" aria-live="polite">
        <Rich>{explain}</Rich>
      </div>
      {predict && (
        <div className="explain">
          {needGuess ? (
            <GuessCard
              key={i}
              question={`Prefiks berapa untuk $${nextAlloc!.need.hosts}$ host?`}
              options={prefixOptions(nextAlloc!.prefix, i * 131 + nextAlloc!.need.hosts).map((p) => `$/${p}$`)}
              answer={prefixOptions(nextAlloc!.prefix, i * 131 + nextAlloc!.need.hosts).indexOf(nextAlloc!.prefix)}
              hint={`Cari $k$ terkecil dengan $2^k-2\\ge ${nextAlloc!.need.hosts}$, lalu prefiks $=32-k$.`}
              onResolve={(ok) => {
                setScore((c) => ({ ok: c.ok + (ok ? 1 : 0), all: c.all + 1 }));
                limitRef.current = undefined; // lepas batas dulu, baru maju
                s.next();
              }}
            />
          ) : (
            <span className="muted">Tebakan berikutnya muncul di sini.</span>
          )}
        </div>
      )}
      <StepControls s={s} blockNext={needGuess} noPlay={predict} unit="Langkah" />
      <div className="toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={predict}
            onChange={(e) => {
              setPredict(e.target.checked);
              if (s.playing) s.toggle();
            }}
          />
          Mode tebak dulu
        </label>
        {predict && (
          <span className="muted" style={{ fontSize: 14 }}>
            Benar {score.ok} dari {score.all} tebakan
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Slide 8: sandbox VLSM ---------- */

const SANDBOX_PARENTS = [
  { key: 'a', label: '172.20.5.0/24 (256 alamat)', network: ip('172.20.5.0'), prefix: 24 },
  { key: 'b', label: '10.8.0.0/23 (512 alamat)', network: ip('10.8.0.0'), prefix: 23 },
  { key: 'c', label: '192.168.40.0/25 (128 alamat)', network: ip('192.168.40.0'), prefix: 25 },
];
const MAX_NEEDS = 6;

export function VlsmSandbox() {
  const [pk, setPk] = useState('a');
  const parent = SANDBOX_PARENTS.find((p) => p.key === pk)!;
  // Draf teks per baris: kolom boleh kosong saat mengetik; angka sah (≥ 1) dipakai untuk perhitungan.
  const [drafts, setDrafts] = useState<string[]>(['40', '20', '12', '2']);
  const hosts = useMemo(
    () =>
      drafts.map((d) => {
        const n = Math.floor(Number(d));
        return Number.isFinite(n) && n >= 1 ? Math.min(n, 100000) : 1;
      }),
    [drafts],
  );
  const needs = useMemo<Need[]>(() => hosts.map((h, i) => ({ name: `Subnet ${i + 1}`, hosts: h })), [hosts]);
  const res = useMemo(() => allocateVlsm(parent, needs), [parent, needs]);
  const total = blockSize(parent.prefix);
  const used = total - res.freeAddresses;

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 380, flex: 'none' }}>
        <label className="muted" style={{ fontSize: 16 }}>
          Blok induk:{' '}
          <select aria-label="Pilih blok induk" value={pk} onChange={(e) => setPk(e.target.value)}>
            {SANDBOX_PARENTS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="card" style={{ padding: 10, height: 330, boxSizing: 'border-box' }}>
          <div className="muted" style={{ fontSize: 14, marginBottom: 6 }}>
            Kebutuhan host tiap subnet
          </div>
          {drafts.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 16 }}>
              <span style={{ color: res.allocs.findIndex((a) => a.need.name === needs[i].name) >= 0 ? blockColor(res.allocs.findIndex((a) => a.need.name === needs[i].name)) : undefined }}>■</span>
              <span style={{ width: 90, whiteSpace: 'nowrap' }}>Subnet {i + 1}</span>
              <input
                className="need-input"
                type="text"
                inputMode="numeric"
                value={d}
                aria-label={`Host untuk Subnet ${i + 1}`}
                onChange={(e) => setDrafts((a) => a.map((x, k) => (k === i ? e.target.value.replace(/\D/g, '').slice(0, 6) : x)))}
                onBlur={() => setDrafts((a) => a.map((x, k) => (k === i ? String(hosts[i]) : x)))}
              />
              <button className="btn small" aria-label={`Hapus Subnet ${i + 1}`} disabled={drafts.length <= 1} onClick={() => setDrafts((a) => a.filter((_, k) => k !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button className="btn small" disabled={drafts.length >= MAX_NEEDS} onClick={() => setDrafts((a) => [...a, '10'])}>
            + Tambah subnet
          </button>
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Ubah angka host, lalu lihat blok yang dihasilkan. Urutan alokasi selalu dari yang terbesar.
        </div>
      </div>

      <div className="col grow">
        <div className="card" style={{ padding: '18px 18px 10px' }}>
          <VlsmBar parent={{ network: parent.network, size: total }} allocs={res.allocs} />
        </div>
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Hasil alokasi VLSM">
            <thead>
              <tr>
                <th className="left">Subnet</th>
                <th>Host</th>
                <th>Blok</th>
                <th>Host valid</th>
                <th>Host tak terpakai</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: MAX_NEEDS }, (_, r) => {
                const a = res.allocs[r];
                const failedHere = res.failed && r === res.allocs.length;
                const need = res.order[r];
                if (!need) {
                  return (
                    <tr key={r} aria-hidden="true">
                      <td colSpan={5} />
                    </tr>
                  );
                }
                return (
                  <tr key={r}>
                    <td className="left">
                      <span style={{ color: a ? blockColor(r) : undefined }}>■ </span>
                      {need.name}
                    </td>
                    <td>{need.hosts}</td>
                    <td className={a ? 'mono' : failedHere ? 'changed' : ''}>{a ? blk(a) : failedHere ? 'tidak muat' : '—'}</td>
                    <td className="mono" style={{ fontSize: 13 }}>
                      {a ? `.${a.info.first & 255}–.${a.info.last & 255}` : ''}
                    </td>
                    <td>{a ? a.wasted : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={`callout ${res.failed ? 'bad' : 'ok'}`} style={{ minHeight: 84 }} aria-live="polite">
          {res.failed ? (
            res.failed.reason === 'too-big' ? (
              <>
                <b>{res.failed.need.name}</b> membutuhkan <Tex>{String(res.failed.need.hosts)}</Tex> host: lebih besar dari blok induk, jadi dilewati
                {res.allocs.length > 0 ? '; subnet lain tetap dialokasikan.' : '.'}
              </>
            ) : (
              <>
                <b>{res.failed.need.name}</b> (<Tex>{String(res.failed.need.hosts)}</Tex> host, butuh <Tex>{`/${prefixForHosts(res.failed.need.hosts)}`}</Tex>) tidak muat lagi: sisa ruang{' '}
                <Tex>{String(res.freeAddresses)}</Tex> alamat. Pilih blok induk lebih besar atau kurangi kebutuhan.
              </>
            )
          ) : res.freeAddresses === 0 ? (
            <>
              Blok induk terpakai penuh: <Tex>{String(used)}</Tex> dari <Tex>{String(total)}</Tex> alamat.
            </>
          ) : (
            <>
              Terpakai <Tex>{String(used)}</Tex> dari <Tex>{String(total)}</Tex> alamat. Sisa <Tex>{String(res.freeAddresses)}</Tex> alamat bebas mulai{' '}
              <Tex>{formatIp(res.freeFrom)}</Tex>.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
