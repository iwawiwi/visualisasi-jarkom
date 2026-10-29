import { useMemo, useRef, useState } from 'react';
import { type CcRound, type LossKind, type Phase, type Variant, bottleneck, estimateRtt, runCc, simulateFairness, totalSegments, type FairMode } from '../../algorithms/tcpCongestion';
import { GuessCard } from '../../core/components/GuessCard';
import { LegendDot } from '../../core/components/GraphView';
import { Rich } from '../../core/components/Rich';
import { StepControls } from '../../core/components/StepControls';
import { type ChartMark, type ChartSeries, TimeChart } from '../../core/components/TimeChart';
import { Tex } from '../../core/components/Tex';
import { useFragmentStepper } from '../../core/hooks/useFragmentStepper';
import { makeRng } from '../../core/rng';

const niceMax = (v: number, step = 10) => Math.max(step, Math.ceil((v * 1.1) / step) * step);
const lossMarks = (rs: CcRound[]): ChartMark[] => rs.filter((r) => r.loss).map((r) => ({ x: r.round, y: r.cwnd, kind: 'loss' as const, color: r.loss === 'timeout' ? 'var(--c-bad)' : 'var(--c-current)' }));
const PHASE_COLOR: Record<Phase, string> = { ss: 'var(--c-current)', ca: 'var(--c-settled)' };

/* ---------- Slide 2: flow control vs congestion control ---------- */

function RateSlider({ label, value, set, aria }: { label: string; value: number; set: (n: number) => void; aria: string }) {
  return (
    <label className="muted" style={{ fontSize: 17, display: 'block', margin: '8px 0' }}>
      <Rich>{`${label} $${value}$ Mbps`}</Rich>{' '}
      <input type="range" data-prevent-swipe min={1} max={20} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={aria} />
    </label>
  );
}

export function BottleneckLab() {
  const [send, setSend] = useState(14);
  const [recv, setRecv] = useState(10);
  const [link, setLink] = useState(10);
  const b = bottleneck(send, recv, link);
  // Hanya sebanyak yang lolos dari link yang tiba di penerima.
  const arriving = Math.min(send, link);
  const recvFill = Math.max(0, Math.min(1, (arriving - recv) / recv));
  const netFill = Math.max(0, Math.min(1, (send - link) / link));

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 520, flex: 'none' }}>
        <div className="card">
          <RateSlider label="Kecepatan kirim pengirim:" value={send} set={setSend} aria="Kecepatan kirim" />
          <RateSlider label="Kemampuan proses penerima:" value={recv} set={setRecv} aria="Kemampuan penerima" />
          <RateSlider label="Kapasitas jaringan (link sempit):" value={link} set={setLink} aria="Kapasitas jaringan" />
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 15, marginBottom: 6 }}>
            Buffer penerima
          </div>
          <div className="util-bar">
            <div style={{ width: `${recvFill * 100}%`, background: 'var(--c-current)' }} />
          </div>
          <div className="muted" style={{ fontSize: 15, margin: '12px 0 6px' }}>
            Antrean router di link sempit
          </div>
          <div className="util-bar">
            <div style={{ width: `${netFill * 100}%`, background: 'var(--c-bad)' }} />
          </div>
        </div>
      </div>
      <div className="col grow">
        <div className={`callout ${b === 'ok' ? 'ok' : b === 'receiver' ? 'warn' : 'bad'}`} style={{ minHeight: 170 }} aria-live="polite">
          {b === 'both' && (
            <>
              <b>Penerima dan jaringan sama-sama kewalahan.</b> Keduanya sama sempit, jadi dua mekanisme bekerja sekaligus: penerima menurunkan <Tex>{'\\mathrm{rwnd}'}</Tex> dan pengirim menurunkan <Tex>{'\\mathrm{cwnd}'}</Tex>.
            </>
          )}
          {b === 'ok' && (
            <>
              <b>Lancar.</b> Pengirim tidak mengirim lebih cepat daripada yang sanggup diterima penerima maupun dilewatkan jaringan.
            </>
          )}
          {b === 'receiver' && (
            <>
              <b>Penerima kewalahan: flow control.</b> Buffer penerima penuh. Penerima memberi tahu pengirim lewat <Tex>{'\\mathrm{rwnd}'}</Tex> (receive window) agar
              memperlambat.
            </>
          )}
          {b === 'network' && (
            <>
              <b>Jaringan macet: congestion control.</b> Antrean router meluap dan paket dibuang. Pengirim harus menebak sendiri lewat kehilangan paket, lalu mengecilkan{' '}
              <Tex>{'\\mathrm{cwnd}'}</Tex>.
            </>
          )}
        </div>
        <div className="card">
          <Tex block>{'\\text{boleh terkirim}\\le\\min(\\mathrm{rwnd},\\ \\mathrm{cwnd})'}</Tex>
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Dua masalah berbeda: <b>flow control</b> melindungi <i>penerima</i>, <b>congestion control</b> melindungi <i>jaringan</i>. TCP mematuhi keduanya sekaligus.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 3: AIMD interaktif ---------- */

const MAX_ROUNDS = 40;

export function AimdPlay() {
  const [events, setEvents] = useState<(LossKind | null)[]>([]);
  const losses = useMemo(() => Object.fromEntries(events.flatMap((e, i) => (e ? [[i, e]] : []))) as Record<number, LossKind>, [events]);
  const rs = useMemo(() => runCc({ variant: 'reno', ssthresh: 16, rounds: events.length + 1, losses }), [events, losses]);
  const last = rs[rs.length - 1];
  const done = rs.slice(0, -1); // RTT yang sudah selesai dijalani
  const cur = rs.length - 1;
  const add = (e: LossKind | null) => setEvents((x) => (x.length < MAX_ROUNDS ? [...x, e] : x));
  const series: ChartSeries[] = [{ label: 'cwnd', color: 'var(--c-check)', step: true, values: rs.map((r) => r.cwnd) }];

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 620, flex: 'none' }}>
        <div className="card" style={{ padding: 10 }}>
          <TimeChart
            xMax={Math.max(20, cur + 2)}
            xTicks={Array.from({ length: Math.floor(Math.max(20, cur + 2) / 5) + 1 }, (_, k) => k * 5)}
            yMax={niceMax(Math.max(...rs.map((r) => r.cwnd), 20), 10)}
            xLabel="RTT"
            yLabel="$\mathrm{cwnd}$ (MSS)"
            series={series}
            marks={lossMarks(done)}
            hLines={[{ y: last.ssthresh, label: '$\\mathrm{ssthresh}$', color: 'var(--c-current)' }]}
            viewHeight={300}
            ariaLabel="Grafik cwnd terhadap RTT"
          />
        </div>
        <div className="toolbar">
          <button className="btn primary" onClick={() => add(null)} disabled={events.length >= MAX_ROUNDS}>
            Kirim 1 RTT ▶
          </button>
          <button className="btn" onClick={() => add('3dup')} disabled={events.length >= MAX_ROUNDS}>
            ✕ 3 ACK ganda
          </button>
          <button className="btn" onClick={() => add('timeout')} disabled={events.length >= MAX_ROUNDS}>
            ✕ Timeout
          </button>
          <button className="btn small" onClick={() => setEvents([])} disabled={events.length === 0}>
            ⟲ Ulang
          </button>
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ minHeight: 120 }}>
          <div style={{ fontSize: 20 }}>
            <Rich>{`RTT sekarang: $${cur}$ · $\\mathrm{cwnd}=${last.cwnd}$ · $\\mathrm{ssthresh}=${last.ssthresh}$`}</Rich>
          </div>
          <div style={{ fontSize: 18, marginTop: 6, color: PHASE_COLOR[last.phase] }}>{last.phase === 'ss' ? 'Slow start' : 'Congestion avoidance'}</div>
        </div>
        <div className="explain" aria-live="polite">
          <Rich>{done.length ? done[done.length - 1].text : 'Tekan "Kirim 1 RTT" untuk memulai. Lalu coba "3 ACK ganda" saat cwnd sudah besar.'}</Rich>
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          <b>AIMD:</b> <i>additive increase</i> +1 MSS per RTT, <i>multiplicative decrease</i> dibagi dua saat loss. Hasilnya grafik bergerigi: <b>gigi gergaji</b>.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 4: tiga fase ---------- */

const PHASES = [
  { key: 'ss' as const, name: 'Slow start', body: '$\\mathrm{cwnd}$ mulai dari $1$ MSS dan berlipat ganda tiap RTT ($1,2,4,8,\\ldots$) sampai menyentuh $\\mathrm{ssthresh}$. Disebut "slow" karena start dari kecil, tetapi tumbuhnya eksponensial.' },
  { key: 'ca' as const, name: 'Congestion avoidance', body: 'Setelah mencapai $\\mathrm{ssthresh}$, tumbuh hati-hati: hanya $+1$ MSS per RTT (linear), meraba kapasitas jaringan.' },
  {
    key: 'loss' as const,
    name: 'Reaksi terhadap loss',
    body: '3 ACK ganda (kehilangan ringan): $\\mathrm{ssthresh}=\\mathrm{cwnd}/2$; Reno langsung memakai $\\mathrm{cwnd}=\\mathrm{ssthresh}$, Tahoe kembali ke $1$ (Reno asli sebentar memakai $\\mathrm{ssthresh}+3$ pada fast recovery; di sini disederhanakan). Timeout (parah): keduanya kembali ke $1$ dan slow start.',
  },
];

export function PhaseMap() {
  const [sel, setSel] = useState<'ss' | 'ca' | 'loss'>('ss');
  const rs = useMemo(() => runCc({ variant: 'reno', ssthresh: 16, rounds: 30, losses: { 10: '3dup', 20: 'timeout' } }), []);
  const mk = (p: Phase): ChartSeries => ({
    label: p,
    color: PHASE_COLOR[p],
    step: true,
    dashed: sel !== 'loss' && sel !== p,
    values: rs.map((r, i) => (r.phase === p || rs[i - 1]?.phase === p ? r.cwnd : null)),
  });
  const body = PHASES.find((x) => x.key === sel)!;

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 620, flex: 'none' }}>
        <div className="card" style={{ padding: 10 }}>
          <div className="legend" style={{ paddingBottom: 4 }}>
            <LegendDot color="var(--c-current)" label="slow start" />
            <LegendDot color="var(--c-settled)" label="congestion avoidance" />
            <LegendDot color="var(--c-text-muted)" label="$\\mathrm{ssthresh}$ (garis putus-putus)" />
          </div>
          <TimeChart
            xMax={30}
            yMax={30}
            xLabel="RTT"
            yLabel="$\mathrm{cwnd}$ (MSS)"
            series={[{ label: 'ssthresh', color: 'var(--c-text-muted)', dashed: true, step: true, values: rs.map((r) => r.ssthresh) }, mk('ss'), mk('ca')]}
            marks={lossMarks(rs)}
            xTicks={[0, 5, 10, 15, 20, 25, 30]}
            viewHeight={300}
            ariaLabel="Fase-fase kontrol kongesti pada grafik cwnd"
          />
          <div className="muted" style={{ fontSize: 14 }}>
            ✕ jingga = 3 ACK ganda (Reno) · ✕ merah = timeout
          </div>
        </div>
      </div>
      <div className="col grow">
        <div role="group" aria-label="Fase" style={{ display: 'grid', gap: 8 }}>
          {PHASES.map((p) => (
            <button key={p.key} className={`btn${sel === p.key ? ' active' : ''}`} aria-pressed={sel === p.key} onClick={() => setSel(p.key)} style={{ textAlign: 'left', fontSize: 18 }}>
              {p.name}
            </button>
          ))}
        </div>
        <div className="card" style={{ minHeight: 170, fontSize: 19 }}>
          <Rich>{body.body}</Rich>
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 5: simulator per RTT ---------- */

const SIM_ROUNDS = 18;

/** Pilihan jawaban: nilai benar + pengecoh konseptual (naik 1, berlipat dua, kembali ke 1, separuh, ssthresh), diacak. */
function numOptions(next: number, cur: number, ssthresh: number, seed: number): number[] {
  const cands = [cur + 1, cur * 2, 1, Math.floor(cur / 2), ssthresh, next + 1, next + 2].filter((v) => v >= 1 && v !== next);
  const distractors = [...new Set(cands)].slice(0, 3);
  for (let v = next + 3; distractors.length < 3; v++) if (!distractors.includes(v)) distractors.push(v);
  const all = [next, ...distractors];
  const rng = makeRng(seed);
  for (let k = all.length - 1; k > 0; k--) {
    const j = rng.int(k + 1);
    [all[k], all[j]] = [all[j], all[k]];
  }
  return all;
}

export function CcSim() {
  const [variant, setVariant] = useState<Variant>('reno');
  const [loss, setLoss] = useState<'none' | LossKind>('3dup');
  const [predict, setPredict] = useState(false);
  const [score, setScore] = useState({ ok: 0, all: 0 });
  const rs = useMemo(() => runCc({ variant, ssthresh: 16, rounds: SIM_ROUNDS, losses: loss === 'none' ? {} : { 8: loss } }), [variant, loss]);
  const limitRef = useRef<number | undefined>(undefined);
  const s = useFragmentStepper(SIM_ROUNDS, 1300, limitRef);
  const i = s.index;
  const cur = rs[i];
  const next = rs[i + 1];
  const needGuess = predict && !!next;
  limitRef.current = needGuess ? i : undefined;
  const opts = next ? numOptions(next.cwnd, cur.cwnd, cur.ssthresh, i * 71 + next.cwnd) : [];
  const shown = rs.slice(0, i + 1);
  const windowRows = shown.slice(-5);

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {s.fragments}
      <div className="col" style={{ width: 620, flex: 'none' }}>
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Varian TCP">
            {(['reno', 'tahoe'] as Variant[]).map((v) => (
              <button
                key={v}
                className={variant === v ? 'on' : ''}
                aria-pressed={variant === v}
                onClick={() => {
                  setVariant(v);
                  s.reset();
                }}
              >
                {v === 'reno' ? 'Reno' : 'Tahoe'}
              </button>
            ))}
          </div>
          <label className="muted" style={{ fontSize: 15 }}>
            Di RTT 8:{' '}
            <select
              aria-label="Kejadian di RTT 8"
              value={loss}
              onChange={(e) => {
                setLoss(e.target.value as typeof loss);
                s.reset();
              }}
            >
              <option value="3dup">3 ACK ganda</option>
              <option value="timeout">timeout</option>
              <option value="none">tidak ada loss</option>
            </select>
          </label>
        </div>
        <div className="card" style={{ padding: 10 }}>
          <TimeChart
            xMax={SIM_ROUNDS - 1}
            xTicks={[0, 4, 8, 12, 16]}
            yMax={30}
            xLabel="RTT"
            yLabel="$\mathrm{cwnd}$ (MSS)"
            series={[{ label: 'cwnd', color: 'var(--c-check)', step: true, values: shown.map((r) => r.cwnd) }]}
            marks={lossMarks(shown)}
            hLines={[{ y: cur.ssthresh, label: '$\\mathrm{ssthresh}$', color: 'var(--c-current)' }]}
            cursor={i}
            viewHeight={270}
            ariaLabel="Grafik cwnd per RTT"
          />
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Lima RTT terakhir">
            <thead>
              <tr>
                <th className="left">RTT</th>
                <th>
                  <Tex>{'\\mathrm{cwnd}'}</Tex>
                </th>
                <th>
                  <Tex>{'\\mathrm{ssthresh}'}</Tex>
                </th>
                <th>Fase</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, k) => {
                const r = windowRows[k];
                if (!r) {
                  return (
                    <tr key={`pad-${k}`} aria-hidden="true">
                      <td colSpan={4} />
                    </tr>
                  );
                }
                return (
                  <tr key={`r-${r.round}`} className={r.round === i ? 'live' : ''}>
                    <td className="left">{r.round}</td>
                    <td className={r.loss ? 'changed' : ''}>{r.cwnd}</td>
                    <td>{r.ssthresh}</td>
                    <td>{r.phase === 'ss' ? 'slow start' : 'cong. avoidance'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="explain" aria-live="polite">
          {needGuess ? (
            <GuessCard
              key={`${variant}-${loss}-${i}`}
              question="Berapa cwnd pada RTT berikutnya?"
              options={opts.map((o) => `$${o}$`)}
              answer={opts.indexOf(next!.cwnd)}
              hint={cur.loss ? 'Ada kehilangan: $\\mathrm{ssthresh}=\\lfloor \\mathrm{cwnd}/2\\rfloor$. Apakah cwnd ikut turun ke $1$ atau hanya ke ssthresh?' : cur.phase === 'ss' ? 'Slow start: cwnd berlipat ganda (maksimal sampai ssthresh).' : 'Congestion avoidance: cwnd naik $1$.'}
              onResolve={(ok) => {
                setScore((c) => ({ ok: c.ok + (ok ? 1 : 0), all: c.all + 1 }));
                limitRef.current = undefined; // lepas batas dulu, baru maju
                s.next();
              }}
            />
          ) : (
            <Rich>{cur.text}</Rich>
          )}
        </div>
        <StepControls s={s} unit="RTT" blockNext={needGuess} noPlay={predict} />
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
    </div>
  );
}

/* ---------- Slide 6: Tahoe vs Reno ---------- */

export function TahoeReno() {
  const [kind, setKind] = useState<LossKind>('3dup');
  const [at, setAt] = useState(8);
  const out = useMemo(() => {
    const losses = { [at]: kind } as Record<number, LossKind>;
    const run = (variant: Variant) => runCc({ variant, ssthresh: 16, rounds: 24, losses });
    const tahoe = run('tahoe');
    const reno = run('reno');
    return { tahoe, reno };
  }, [kind, at]);
  const total = { tahoe: totalSegments(out.tahoe), reno: totalSegments(out.reno) };

  const chart = (rs: CcRound[], color: string, label: string) => (
    <div className="card" style={{ padding: 8, flex: 1 }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <TimeChart xMax={23} xTicks={[0, 4, 8, 12, 16, 20]} yMax={30} xLabel="RTT" yLabel="$\\mathrm{cwnd}$ (MSS)" series={[{ label, color, step: true, values: rs.map((r) => r.cwnd) }]} marks={lossMarks(rs)} viewHeight={230} height={215} ariaLabel={`cwnd ${label}`} />
    </div>
  );

  return (
    <div className="col">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Jenis kehilangan">
          <button className={kind === '3dup' ? 'on' : ''} aria-pressed={kind === '3dup'} onClick={() => setKind('3dup')}>
            3 ACK ganda
          </button>
          <button className={kind === 'timeout' ? 'on' : ''} aria-pressed={kind === 'timeout'} onClick={() => setKind('timeout')}>
            Timeout
          </button>
        </div>
        <label className="muted" style={{ fontSize: 17 }}>
          Loss di RTT <b style={{ color: 'var(--c-text)' }}>{at}</b>{' '}
          <input type="range" data-prevent-swipe min={6} max={14} value={at} onChange={(e) => setAt(Number(e.target.value))} aria-label="RTT terjadinya kehilangan" />
        </label>
      </div>
      <div className="row">
        {chart(out.tahoe, 'var(--c-check)', 'Tahoe')}
        {chart(out.reno, 'var(--c-settled)', 'Reno')}
      </div>
      <div className="row">
        <div className="card grow">
          <Rich>{`Total segmen terkirim dalam $24$ RTT: Tahoe $${total.tahoe}$ · Reno $${total.reno}$`}</Rich>
        </div>
        <div className={`callout grow ${kind === 'timeout' ? 'warn' : 'ok'}`} style={{ minHeight: 96 }}>
          {kind === 'timeout' ? (
            <>
              Pada <b>timeout</b> keduanya identik: cwnd kembali ke <Tex>1</Tex>. Pembeda Reno hanya muncul pada kehilangan ringan.
            </>
          ) : (
            <>
              Pada <b>3 ACK ganda</b>, Reno tidak membuang semua kemajuan: ia melanjutkan dari <Tex>{'\\mathrm{cwnd}/2'}</Tex> dan lebih banyak mengirim (selisih{' '}
              <Tex>{String(total.reno - total.tahoe)}</Tex> segmen).
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 7: sandbox ---------- */

const SB_ROUNDS = 24;
const NEXT_LOSS: Record<string, LossKind | null> = { none: '3dup', '3dup': 'timeout', timeout: null };

export function CcSandbox() {
  const [ss, setSs] = useState(16);
  const [variant, setVariant] = useState<Variant>('reno');
  const [ev, setEv] = useState<(LossKind | null)[]>(() => Array(SB_ROUNDS).fill(null).map((_, i) => (i === 10 ? '3dup' : null)));
  const losses = useMemo(() => Object.fromEntries(ev.flatMap((e, i) => (e ? [[i, e]] : []))) as Record<number, LossKind>, [ev]);
  const rs = useMemo(() => runCc({ variant, ssthresh: ss, rounds: SB_ROUNDS, losses }), [variant, ss, losses]);
  const peak = Math.max(...rs.map((r) => r.cwnd));

  return (
    <div className="col">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Varian TCP">
          {(['reno', 'tahoe'] as Variant[]).map((v) => (
            <button key={v} className={variant === v ? 'on' : ''} aria-pressed={variant === v} onClick={() => setVariant(v)}>
              {v === 'reno' ? 'Reno' : 'Tahoe'}
            </button>
          ))}
        </div>
        <label className="muted" style={{ fontSize: 17 }}>
          <Rich>{`$\\mathrm{ssthresh}$ awal $=${ss}$`}</Rich>{' '}
          <input type="range" data-prevent-swipe min={4} max={32} value={ss} onChange={(e) => setSs(Number(e.target.value))} aria-label="ssthresh awal" />
        </label>
        <button className="btn small" onClick={() => setEv(Array(SB_ROUNDS).fill(null))}>
          Hapus semua loss
        </button>
      </div>
      <div className="card" style={{ padding: 10 }}>
        <TimeChart
          xMax={SB_ROUNDS - 1}
          xTicks={[0, 4, 8, 12, 16, 20]}
          yMax={niceMax(Math.max(peak, 20), 10)}
          xLabel="RTT"
          yLabel="$\mathrm{cwnd}$ (MSS)"
          series={[{ label: 'cwnd', color: 'var(--c-check)', step: true, values: rs.map((r) => r.cwnd) }]}
          marks={lossMarks(rs)}
          viewHeight={250}
          height={250}
          ariaLabel="Grafik cwnd sandbox"
        />
      </div>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="muted" style={{ fontSize: 14, marginBottom: 4 }}>
          Klik sebuah RTT untuk bergantian: tanpa loss → 3 ACK ganda (3) → timeout (T) → kosong.
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
          {ev.map((e, i) => (
            <button
              key={i}
              className={`btn small${e ? ' active' : ''}`}
              style={{ padding: '4px 0', width: 40, flex: 'none', fontFamily: 'var(--font-mono)' }}
              aria-label={`RTT ${i}: ${e === '3dup' ? '3 ACK ganda' : e === 'timeout' ? 'timeout' : 'tanpa loss'}`}
              onClick={() => setEv((a) => a.map((x, k) => (k === i ? NEXT_LOSS[x ?? 'none'] : x)))}
            >
              {e === '3dup' ? '3' : e === 'timeout' ? 'T' : i}
            </button>
          ))}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 15 }}>
        <Rich>{`Total segmen terkirim: $${totalSegments(rs)}$ · $\\mathrm{cwnd}$ tertinggi: $${peak}$`}</Rich>
      </div>
    </div>
  );
}

/* ---------- Slide 8: keadilan ---------- */

const CAP = 60;

export function Fairness() {
  const [mode, setMode] = useState<FairMode>('aimd');
  const [x1, setX1] = useState(40);
  const [x2, setX2] = useState(6);
  const [upTo, setUpTo] = useState(60);
  const pts = useMemo(() => simulateFairness(x1, x2, CAP, mode, 60), [x1, x2, mode]);
  const shown = pts.slice(0, upTo + 1);
  const end = shown[shown.length - 1];
  const S = 380;
  const P = (v: number) => 30 + (Math.min(v, CAP) / CAP) * (S - 40);
  const Q = (v: number) => S - 10 - (Math.min(v, CAP) / CAP) * (S - 40);

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 440, flex: 'none' }}>
        <div className="card" style={{ padding: 8 }}>
          <svg viewBox={`0 0 ${S} ${S}`} className="graph" role="img" aria-label="Lintasan dua aliran pada bidang x1 terhadap x2" style={{ height: 400 }}>
            <line x1={P(0)} y1={Q(0)} x2={P(CAP)} y2={Q(CAP)} stroke="var(--c-settled)" strokeWidth={2} strokeDasharray="6 5" />
            <line x1={P(CAP)} y1={Q(0)} x2={P(0)} y2={Q(CAP)} stroke="var(--c-bad)" strokeWidth={2} strokeDasharray="6 5" />
            <rect x={P(0)} y={Q(CAP)} width={P(CAP) - P(0)} height={Q(0) - Q(CAP)} fill="none" stroke="var(--c-border)" />
            <polyline fill="none" stroke="var(--c-check)" strokeWidth={2.5} strokeLinejoin="round" points={shown.map((p) => `${P(p.x1)},${Q(p.x2)}`).join(' ')} />
            <circle cx={P(shown[0].x1)} cy={Q(shown[0].x2)} r={5} fill="var(--c-source)" />
            <circle cx={P(end.x1)} cy={Q(end.x2)} r={6} fill="var(--c-current)" />
            <foreignObject x={P(CAP) - 150} y={Q(CAP) - 2} width={150} height={20}>
              <div className="chart-label" style={{ textAlign: 'right', color: 'var(--c-bad)' }}>
                <Rich>{'$x_1+x_2=C$ (kapasitas)'}</Rich>
              </div>
            </foreignObject>
            <foreignObject x={P(CAP) - 110} y={Q(CAP) + 60} width={120} height={20}>
              <div className="chart-label" style={{ color: 'var(--c-settled)' }}>
                <Rich>{'$x_1=x_2$ (adil)'}</Rich>
              </div>
            </foreignObject>
            <foreignObject x={S / 2 - 40} y={S - 22} width={80} height={20}>
              <div className="chart-label" style={{ textAlign: 'center' }}>
                <Rich>{'$x_1$'}</Rich>
              </div>
            </foreignObject>
            <foreignObject x={0} y={S / 2} width={26} height={20}>
              <div className="chart-label">
                <Rich>{'$x_2$'}</Rich>
              </div>
            </foreignObject>
          </svg>
        </div>
      </div>
      <div className="col grow">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Aturan penyesuaian">
            <button className={mode === 'aimd' ? 'on' : ''} aria-pressed={mode === 'aimd'} onClick={() => setMode('aimd')}>
              AIMD (tambah 1, bagi dua)
            </button>
            <button className={mode === 'aiad' ? 'on' : ''} aria-pressed={mode === 'aiad'} onClick={() => setMode('aiad')}>
              AIAD (tambah 1, kurangi 4)
            </button>
          </div>
        </div>
        <div className="card">
          <label className="muted" style={{ fontSize: 16, display: 'block', margin: '4px 0' }}>
            <Rich>{`Awal aliran 1: $x_1=${x1}$`}</Rich>{' '}
            <input type="range" data-prevent-swipe min={1} max={50} value={x1} onChange={(e) => setX1(Number(e.target.value))} aria-label="Laju awal aliran 1" />
          </label>
          <label className="muted" style={{ fontSize: 16, display: 'block', margin: '4px 0' }}>
            <Rich>{`Awal aliran 2: $x_2=${x2}$`}</Rich>{' '}
            <input type="range" data-prevent-swipe min={1} max={50} value={x2} onChange={(e) => setX2(Number(e.target.value))} aria-label="Laju awal aliran 2" />
          </label>
          <label className="muted" style={{ fontSize: 16, display: 'block', margin: '4px 0' }}>
            Sampai RTT {upTo}{' '}
            <input type="range" data-prevent-swipe min={0} max={60} value={upTo} onChange={(e) => setUpTo(Number(e.target.value))} aria-label="Sampai RTT ke berapa" />
          </label>
        </div>
        <div className="card" style={{ fontSize: 20 }}>
          <Rich>{`Selisih sekarang: $|x_1-x_2|=${Math.abs(end.x1 - end.x2).toFixed(1)}$ (awal $${Math.abs(x1 - x2)}$)`}</Rich>
        </div>
        <div className={`callout ${mode === 'aimd' ? 'ok' : 'bad'}`} style={{ minHeight: 120 }}>
          {mode === 'aimd' ? (
            <>
              <b>AIMD adil.</b> Penambahan sama rata tidak mengubah selisih, tetapi pembagian dua <i>memperkecil selisih</i> setiap kali macet. Lintasan bergerak menuju garis adil.
            </>
          ) : (
            <>
              <b>AIAD tidak adil.</b> Menambah dan mengurangi dengan jumlah tetap tidak mengubah selisih sama sekali: yang kecil tetap kecil selamanya.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 9: estimasi RTT dan timeout ---------- */

const BASE_SAMPLES = [100, 104, 98, 110, 96, 102, 99, 105, 101, 97, 103, 100];

export function RttTimer() {
  const [samples, setSamples] = useState<number[]>(BASE_SAMPLES);
  const pts = useMemo(() => estimateRtt(samples), [samples]);
  const last = pts[pts.length - 1];
  const peak = Math.max(...pts.map((p) => Math.max(p.sample, p.timeout)));
  const add = (v: number) => setSamples((a) => (a.length < 30 ? [...a, v] : a));
  const jitter = () => 96 + Math.round(((samples.length * 37) % 13));

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 620, flex: 'none' }}>
        <div className="card" style={{ padding: 10 }}>
          <div className="legend" style={{ paddingBottom: 4 }}>
            <LegendDot color="var(--c-text-muted)" label="$\mathrm{SampleRTT}$" />
            <LegendDot color="var(--c-check)" label="$\mathrm{EstimatedRTT}$" />
            <LegendDot color="var(--c-bad)" label="$\mathrm{TimeoutInterval}$" />
          </div>
          <TimeChart
            xMax={Math.max(11, samples.length - 1)}
            xTicks={Array.from({ length: Math.floor(Math.max(11, samples.length - 1) / 5) + 1 }, (_, k) => k * 5)}
            yMax={niceMax(peak, 50)}
            xLabel="sampel ke-"
            yLabel="milidetik"
            series={[
              { label: 'timeout', color: 'var(--c-bad)', values: pts.map((p) => p.timeout) },
              { label: 'est', color: 'var(--c-check)', values: pts.map((p) => p.est) },
              { label: 'sample', color: 'var(--c-text-muted)', dashed: true, values: pts.map((p) => p.sample) },
            ]}
            viewHeight={290}
            ariaLabel="SampleRTT, EstimatedRTT, dan TimeoutInterval"
          />
        </div>
        <div className="toolbar">
          <button className="btn" onClick={() => add(jitter())} disabled={samples.length >= 30}>
            + Sampel normal
          </button>
          <button className="btn" onClick={() => add(300)} disabled={samples.length >= 30}>
            + Lonjakan 300 ms
          </button>
          <button className="btn small" onClick={() => setSamples(BASE_SAMPLES)}>
            ⟲ Ulang
          </button>
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ fontSize: 19 }}>
          <Tex block>{'1.\\ \\mathrm{Dev}\\leftarrow(1-\\beta)\\,\\mathrm{Dev}+\\beta\\,|\\mathrm{Sample}-\\mathrm{Est}_{\\text{lama}}|,\\quad \\beta=\\tfrac14'}</Tex>
          <Tex block>{'2.\\ \\mathrm{Est}\\leftarrow(1-\\alpha)\\,\\mathrm{Est}+\\alpha\\,\\mathrm{Sample},\\quad \\alpha=\\tfrac18'}</Tex>
          <Tex block>{'3.\\ \\mathrm{Timeout}=\\mathrm{Est}+4\\,\\mathrm{Dev}'}</Tex>
        </div>
        <div className="card" style={{ fontSize: 19 }}>
          <Rich>{`Sampel terakhir $${last.sample}$ ms → $\\mathrm{Est}=${last.est.toFixed(1)}$, $\\mathrm{Dev}=${last.dev.toFixed(1)}$, $\\mathrm{Timeout}=${last.timeout.toFixed(1)}$ ms`}</Rich>
        </div>
        <div className="callout" style={{ minHeight: 110 }}>
          Timer terlalu pendek memicu pengiriman ulang yang tidak perlu; terlalu panjang membuat loss lambat dideteksi. Karena itu timeout mengikuti <b>rata-rata</b> RTT
          ditambah <b>margin</b> yang melebar saat RTT bergejolak.
        </div>
      </div>
    </div>
  );
}
