import { type ReactElement, useMemo, useRef, useState } from 'react';
import { backoffMax, backoffWait, simulateBackoff, simulateSlotted, slottedSuccess, spaceTime } from '../../algorithms/csma';
import { GuessCard } from '../../core/components/GuessCard';
import { Rich } from '../../core/components/Rich';
import { StepControls } from '../../core/components/StepControls';
import { Tex } from '../../core/components/Tex';
import { TimeChart } from '../../core/components/TimeChart';
import { LegendDot } from '../../core/components/GraphView';
import { useFragmentStepper } from '../../core/hooks/useFragmentStepper';
import { makeRng } from '../../core/rng';

/* ---------- Slide 2: tiga cara berbagi kanal ---------- */

const CLASSES = [
  {
    key: 'part',
    name: 'Membagi kanal',
    examples: 'TDMA, FDMA, CDMA',
    idea: 'Kanal dipecah (waktu, frekuensi, atau kode) dan tiap stasiun diberi jatah tetap.',
    pros: 'Tanpa tabrakan, adil.',
    cons: 'Jatah terbuang saat stasiun diam; beban ringan jadi boros.',
  },
  {
    key: 'rand',
    name: 'Akses acak',
    examples: 'ALOHA, CSMA, CSMA/CD (Ethernet)',
    idea: 'Siapa pun boleh mengirim kapan saja; bila bertabrakan, tunggu acak lalu coba lagi.',
    pros: 'Sederhana dan efisien saat beban ringan; satu stasiun bisa memakai seluruh kanal.',
    cons: 'Tabrakan menurunkan efisiensi saat ramai.',
  },
  {
    key: 'turn',
    name: 'Bergiliran',
    examples: 'Polling, token ring',
    idea: 'Ada tanda giliran (master atau token): hanya pemegangnya yang boleh mengirim.',
    pros: 'Tanpa tabrakan, efisien saat ramai.',
    cons: 'Overhead giliran; bila token/master gagal, seluruh jaringan terhenti.',
  },
];

export function MacClasses() {
  const [k, setK] = useState('rand');
  const c = CLASSES.find((x) => x.key === k)!;
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 320, flex: 'none' }}>
        <div role="group" aria-label="Kelas protokol MAC" style={{ display: 'grid', gap: 8 }}>
          {CLASSES.map((x) => (
            <button key={x.key} className={`btn${k === x.key ? ' active' : ''}`} aria-pressed={k === x.key} onClick={() => setK(x.key)} style={{ textAlign: 'left', fontSize: 19 }}>
              {x.name}
            </button>
          ))}
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ minHeight: 120, fontSize: 20 }}>
          {c.idea}
          <div className="muted" style={{ fontSize: 16, marginTop: 8 }}>
            Contoh: {c.examples}
          </div>
        </div>
        <div className="row">
          <div className="callout ok grow" style={{ minHeight: 100 }}>
            <b>Kelebihan:</b> {c.pros}
          </div>
          <div className="callout bad grow" style={{ minHeight: 100 }}>
            <b>Kekurangan:</b> {c.cons}
          </div>
        </div>
        <div className="muted" style={{ fontSize: 16 }}>
          Ethernet memakai <b>akses acak</b> dengan CSMA/CD. Kita telusuri bagian-bagiannya satu per satu.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 3: slotted ALOHA ---------- */

export function AlohaLab() {
  const [n, setN] = useState(10);
  const [p, setP] = useState(0.1);
  const [seed, setSeed] = useState(1);
  const curve = useMemo(() => Array.from({ length: 201 }, (_, i) => i / 200), []);
  const eff = slottedSuccess(n, p);
  const run = useMemo(() => simulateSlotted(n, p, 40, seed), [n, p, seed]);
  const counts = { success: run.slots.filter((s) => s.outcome === 'success').length, collision: run.slots.filter((s) => s.outcome === 'collision').length, empty: run.slots.filter((s) => s.outcome === 'empty').length };

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 620, flex: 'none' }}>
        <div className="card" style={{ padding: 10 }}>
          <TimeChart
            xMax={1}
            yMax={0.5}
            yTicks={[0, 0.25, 0.5]}
            xTicks={[0, 0.25, 0.5, 0.75, 1]}
            xLabel="peluang kirim per slot ($p$)"
            yLabel="efisiensi $Np(1-p)^{N-1}$"
            series={[{ label: 'eff', color: 'var(--c-check)', xs: curve, values: curve.map((x) => slottedSuccess(n, x)) }]}
            marks={[{ x: p, y: eff, kind: 'dot' }]}
            hLines={[{ y: 1 / Math.E, label: '$1/e\\approx 0{,}37$', color: 'var(--c-settled)' }]}
            viewHeight={290}
            ariaLabel="Efisiensi slotted ALOHA terhadap peluang kirim"
          />
        </div>
        <div className="card" style={{ padding: '8px 12px' }}>
          <div className="muted" style={{ fontSize: 14, marginBottom: 6 }}>
            40 slot hasil simulasi
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }} role="img" aria-label={`${counts.success} sukses, ${counts.collision} tabrakan, ${counts.empty} kosong`}>
            {run.slots.map((s) => (
              <span
                key={s.slot}
                style={{ width: 26, height: 22, borderRadius: 5, border: '1.5px solid', borderColor: s.outcome === 'success' ? 'var(--c-settled)' : s.outcome === 'collision' ? 'var(--c-bad)' : 'var(--c-border)', background: s.outcome === 'success' ? 'var(--c-settled-soft)' : s.outcome === 'collision' ? 'var(--c-bad-soft)' : 'transparent' }}
              />
            ))}
          </div>
          <div className="legend" style={{ paddingTop: 6 }}>
            <LegendDot color="var(--c-settled)" label="sukses" />
            <LegendDot color="var(--c-bad)" label="tabrakan" />
            <span className="muted" style={{ fontSize: 13 }}>
              kosong = tanpa isi
            </span>
          </div>
        </div>
      </div>
      <div className="col grow">
        <div className="card">
          <label className="muted" style={{ fontSize: 17, display: 'block', margin: '6px 0' }}>
            <Rich>{`Jumlah stasiun $N=${n}$`}</Rich>{' '}
            <input type="range" data-prevent-swipe min={2} max={30} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Jumlah stasiun" />
          </label>
          <label className="muted" style={{ fontSize: 17, display: 'block', margin: '6px 0' }}>
            <Rich>{`Peluang kirim $p=${p.toFixed(2)}$`}</Rich>{' '}
            <input type="range" data-prevent-swipe min={0.01} max={1} step={0.01} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="Peluang kirim per slot" />
          </label>
          <button className="btn small" onClick={() => setSeed((x) => x + 1)}>
            🎲 Simulasi ulang
          </button>
        </div>
        <div className="card" style={{ minHeight: 110 }}>
          <div style={{ fontSize: 20 }}>
            Efisiensi teori: <Tex>{`${(eff * 100).toFixed(1)}\\%`}</Tex>
          </div>
          <div style={{ fontSize: 18, marginTop: 6 }}>
            Hasil simulasi: <Tex>{`${counts.success}/40=${((counts.success / 40) * 100).toFixed(0)}\\%`}</Tex>
          </div>
        </div>
        <div className="callout" style={{ minHeight: 120 }}>
          Puncak efisiensi terjadi di <Tex>{'p=1/N'}</Tex> (sekitar <Tex>{`${(100 / n).toFixed(0)}\\%`}</Tex> kemungkinan kirim per stasiun) dan, untuk <Tex>N</Tex> besar, hanya{' '}
          <b>
            <Tex>{'1/e\\approx 37\\%'}</Tex>
          </b>
          . Terlalu hati-hati menyisakan slot kosong; terlalu agresif menciptakan tabrakan.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 4-5: ruang-waktu, CSMA dan CD ---------- */

const D = 4;
const XA = 70;
const XB = 490;
const SX = (XB - XA) / D;
const SY = 31;
const Y0 = 52;
const yT = (t: number) => Y0 + t * SY;

export function SpaceTimeLab({ withFrame }: { withFrame: boolean }) {
  const [tB, setTB] = useState(2);
  const [frame, setFrame] = useState(12);
  const f = withFrame ? frame : 12;
  const st = spaceTime({ d: D, tA: 0, tB, frame: f });
  const xAt = (x: number) => XA + x * SX;
  // Dengan deteksi tabrakan, stasiun berhenti begitu mendengar tabrakan (ditambah sedikit sinyal jam); batang tidak melewati kanvas.
  const T_MAX = 13.6;
  const endA = Math.min(T_MAX, withFrame && st.collision && st.aSees ? st.aDetects + 0.5 : f);
  const endB = Math.min(T_MAX, tB + (withFrame && st.collision && st.bSees ? Math.max(0, st.bDetects + 0.5 - tB) : f));

  let verdict: ReactElement;
  if (!st.collision) {
    verdict = (
      <>
        <b>Tidak ada tabrakan.</b> Pada <Tex>{`t=${tB.toFixed(1)}`}</Tex> sinyal A sudah sampai di B, jadi B mendengar kanal <b>sibuk</b> dan menunda: inilah <i>carrier sense</i>.
      </>
    );
  } else if (!withFrame) {
    verdict = (
      <>
        <b>Tabrakan walau sudah "mendengar dulu".</b> Sinyal A butuh <Tex>{`d=${D}`}</Tex> untuk sampai, jadi pada <Tex>{`t=${tB.toFixed(1)}`}</Tex> B masih mendengar kanal sepi lalu mengirim. Sinyal bertemu pada{' '}
        <Tex>{`t=${st.meetT.toFixed(1)}`}</Tex>.
      </>
    );
  } else if (st.aSees) {
    verdict = (
      <>
        <b>Tabrakan terdeteksi (CD).</b> A masih mengirim saat sinyal B tiba pada <Tex>{`t=${st.aDetects.toFixed(1)}`}</Tex> (<Tex>{`L\\ge t_B+d`}</Tex>), lalu berhenti dan mengirim sinyal jam (jam signal). Agar tabrakan{' '}
        <i>selalu</i> terdeteksi, bahkan pada kasus terburuk, frame harus <Tex>{`L\\ge 2d=${st.minFrame}`}</Tex>.
      </>
    );
  } else {
    verdict = (
      <>
        <b>Tabrakan tidak terdeteksi!</b> Frame A (<Tex>{`L=${f}`}</Tex>) selesai sebelum sinyal B tiba pada <Tex>{`t=${st.aDetects.toFixed(1)}`}</Tex>. A mengira berhasil. Karena itu Ethernet mewajibkan frame
        minimum <Tex>{'L\\ge 2d'}</Tex>.
      </>
    );
  }

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="card" style={{ padding: 6 }}>
          <svg viewBox="0 0 560 500" className="graph" role="img" aria-label="Diagram ruang-waktu dua stasiun" style={{ height: 500 }}>
            {[XA, XB].map((x, i) => (
              <g key={x}>
                <line x1={x} x2={x} y1={Y0 - 10} y2={490} stroke="var(--c-border)" strokeWidth={3} />
                <text x={x} y={26} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--c-text)">
                  {i === 0 ? 'A' : 'B'}
                </text>
              </g>
            ))}
            <text x={8} y={Y0 + 8} fontSize={12} fill="var(--c-text-muted)">
              waktu ↓
            </text>
            {/* batang pengiriman */}
            <line x1={XA} x2={XA} y1={yT(0)} y2={yT(endA)} stroke="var(--c-check)" strokeWidth={9} strokeLinecap="round" />
            {st.collision && <line x1={XB} x2={XB} y1={yT(tB)} y2={yT(endB)} stroke="var(--c-current)" strokeWidth={9} strokeLinecap="round" />}
            {/* muka gelombang */}
            <line x1={XA} y1={yT(0)} x2={XB} y2={yT(D)} stroke="var(--c-check)" strokeWidth={3} />
            {st.collision && <line x1={XB} y1={yT(tB)} x2={XA} y2={yT(tB + D)} stroke="var(--c-current)" strokeWidth={3} />}
            {st.collision && (
              <g>
                <path d={`M${xAt(st.meetX) - 8},${yT(st.meetT) - 8} l16,16 m0,-16 l-16,16`} stroke="var(--c-bad)" strokeWidth={4} strokeLinecap="round" />
                <foreignObject x={xAt(st.meetX) - 75} y={yT(st.meetT) - 36} width={150} height={22}>
                  <div className="chart-label" style={{ color: 'var(--c-bad)', textAlign: 'center' }}>
                    <Rich>{`tabrakan $t=${st.meetT.toFixed(1)}$`}</Rich>
                  </div>
                </foreignObject>
              </g>
            )}
            {withFrame && st.collision && (
              <circle cx={XA} cy={yT(st.aDetects)} r={7} fill="var(--c-surface)" stroke={st.aSees ? 'var(--c-settled)' : 'var(--c-bad)'} strokeWidth={3} />
            )}
            {!st.collision && (
              <foreignObject x={XB - 190} y={yT(tB) - 4} width={180} height={22}>
                <div className="chart-label" style={{ textAlign: 'right' }}>
                  B menunda (kanal sibuk)
                </div>
              </foreignObject>
            )}
          </svg>
        </div>
      </div>
      <div className="col grow">
        <div className="card">
          <label className="muted" style={{ fontSize: 17, display: 'block', margin: '6px 0' }}>
            <Rich>{`B mulai mengirim pada $t_B=${tB.toFixed(1)}$ (waktu rambat $d=${D}$)`}</Rich>{' '}
            <input type="range" data-prevent-swipe min={0} max={6} step={0.1} value={tB} onChange={(e) => setTB(Number(e.target.value))} aria-label="Waktu B mulai mengirim" />
          </label>
          {withFrame && (
            <label className="muted" style={{ fontSize: 17, display: 'block', margin: '6px 0' }}>
              <Rich>{`Lama frame $L=${frame}$ (batas aman $2d=${2 * D}$)`}</Rich>{' '}
              <input type="range" data-prevent-swipe min={2} max={12} value={frame} onChange={(e) => setFrame(Number(e.target.value))} aria-label="Lama frame" />
            </label>
          )}
        </div>
        <div className={`callout ${!st.collision ? 'ok' : withFrame && !st.aSees ? 'bad' : 'warn'}`} style={{ minHeight: 170 }} aria-live="polite">
          {verdict}
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Garis biru = sinyal A merambat ke B; garis jingga = sinyal B. Batang tebal = lama stasiun mengirim.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 6: exponential backoff ---------- */

const NAMES = ['A', 'B', 'C', 'D'];
const ROWS = 6;

export function BackoffSim() {
  const [stations, setStations] = useState(2);
  const [seed, setSeed] = useState(7);
  const [predict, setPredict] = useState(false);
  const [score, setScore] = useState({ ok: 0, all: 0 });
  const res = useMemo(() => simulateBackoff(stations, seed), [stations, seed]);
  const limitRef = useRef<number | undefined>(undefined);
  const s = useFragmentStepper(res.rounds.length + 1, 1500, limitRef);
  const i = s.index; // 0 = tabrakan pertama; i ≥ 1 = putaran i terungkap
  const next = res.rounds[i];
  const needGuess = predict && !!next;
  limitRef.current = needGuess ? i : undefined;
  const shown = res.rounds.slice(0, i);
  const rows = shown.slice(-ROWS);
  const last = shown[shown.length - 1];

  const guessOpts = next
    ? (() => {
        const lo = Math.min(7, Math.max(0, next.n - 1 - makeRng(i * 17 + seed).int(Math.min(next.n, 3))));
        return [0, 1, 2, 3].map((k) => 2 ** (lo + k));
      })()
    : [];

  let explain: string;
  if (i === 0) explain = `${stations} stasiun mengirim bersamaan: tabrakan ke-$1$. Semuanya berhenti dan memilih waktu tunggu acak $K\\times 512$ bit-time.`;
  else {
    const r = last!;
    const m = backoffMax(r.n);
    const picks = r.picks.map((x) => `${NAMES[x.station]}=${x.k}`).join(', ');
    explain = `Tabrakan ke-$${r.n}$: tiap stasiun memilih $K\\in\\{0,\\ldots,${m}\\}$. Pilihan: ${picks}. ` + (r.resolved ? `$K$ terkecil unik: ${NAMES[r.winners[0]]} mengirim setelah $${backoffWait(r.min)}$ bit-time. Selesai.` : `$K$ terkecil ($${r.min}$) seri antara ${r.winners.map((w) => NAMES[w]).join(' dan ')}: tabrakan lagi.`);
  }

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {s.fragments}
      <div className="col" style={{ width: 600, flex: 'none' }}>
        <div className="toolbar">
          <label className="muted" style={{ fontSize: 16 }}>
            Stasiun yang bertabrakan:{' '}
            <select
              aria-label="Jumlah stasiun"
              value={stations}
              onChange={(e) => {
                setStations(Number(e.target.value));
                s.reset();
              }}
            >
              {[2, 3, 4].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button
            className="btn small"
            onClick={() => {
              setSeed((x) => x + 1);
              s.reset();
            }}
          >
            🎲 Acak ulang
          </button>
        </div>
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Putaran backoff">
            <thead>
              <tr>
                <th className="left">Tabrakan ke-</th>
                <th>
                  Pilihan <Tex>K</Tex>
                </th>
                <th>Dipilih</th>
                <th>Hasil</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROWS }, (_, k) => {
                const r = rows[k];
                if (!r)
                  return (
                    <tr key={`pad-${k}`} aria-hidden="true">
                      <td colSpan={4} />
                    </tr>
                  );
                return (
                  <tr key={`r-${r.n}`} className={r === last ? 'live' : ''}>
                    <td className="left">{r.n}</td>
                    <td className="mono">0 … {backoffMax(r.n)}</td>
                    <td className="mono" style={{ fontSize: 14 }}>
                      {r.picks.map((x) => `${NAMES[x.station]}=${x.k}`).join(' ')}
                    </td>
                    <td className={r.resolved ? 'chosen' : 'changed'}>{r.resolved ? `${NAMES[r.winners[0]]} menang` : 'seri'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          <Rich>{'Satu slot = $512$ bit-time (= $51{,}2\\ \\mu\\text{s}$ pada Ethernet 10 Mbps). Setelah $16$ kali gagal, kartu jaringan menyerah. Disederhanakan: stasiun yang tidak seri menunggu dan tidak ikut bertabrakan lagi.'}</Rich>
        </div>
      </div>
      <div className="col grow">
        <div className="explain" aria-live="polite">
          {needGuess ? (
            <GuessCard
              key={`${stations}-${seed}-${i}`}
              question={`Setelah tabrakan ke-${next!.n}, berapa pilihan nilai $K$?`}
              options={guessOpts.map((o) => `$${o}$`)}
              answer={guessOpts.indexOf(2 ** Math.min(next!.n, 10))}
              hint="Rentang $K$ adalah $0$ sampai $2^n-1$, jadi jumlah pilihannya $2^n$."
              onResolve={(ok) => {
                setScore((c) => ({ ok: c.ok + (ok ? 1 : 0), all: c.all + 1 }));
                limitRef.current = undefined; // lepas batas dulu, baru maju
                s.next();
              }}
            />
          ) : (
            <Rich>{explain}</Rich>
          )}
        </div>
        <StepControls s={s} unit="Langkah" blockNext={needGuess} noPlay={predict} />
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
        <div className="callout" style={{ minHeight: 110 }}>
          Rentang pilihan <b>berlipat ganda</b> tiap tabrakan, jadi makin sering bertabrakan makin kecil peluang seri lagi: jaringan menyesuaikan diri dengan jumlah stasiun yang berebut.
        </div>
      </div>
    </div>
  );
}
