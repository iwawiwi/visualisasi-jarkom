import { useMemo, useRef, useState } from 'react';
import { type ConnScenario, type Segment, type TcpState, buildHandshake, buildTeardown, transferTable } from '../../algorithms/tcpConn';
import { GuessCard } from '../../core/components/GuessCard';
import { Rich } from '../../core/components/Rich';
import { SeqDiagram, type SeqMark, type SeqMessage } from '../../core/components/SeqDiagram';
import { StepControls } from '../../core/components/StepControls';
import { Tex } from '../../core/components/Tex';
import { useFragmentStepper } from '../../core/hooks/useFragmentStepper';
import { makeRng } from '../../core/rng';

const segLabel = (s: Segment) => `${s.flags.join('+')} $\\mathrm{seq}=${s.seq}$${s.ack !== undefined ? ` $\\mathrm{ack}=${s.ack}$` : ''}`;
const STATE_TONE: Record<TcpState, string> = {
  CLOSED: 'var(--c-text-muted)',
  LISTEN: 'var(--c-check)',
  SYN_SENT: 'var(--c-current)',
  SYN_RCVD: 'var(--c-current)',
  ESTABLISHED: 'var(--c-settled)',
  FIN_WAIT_1: 'var(--c-bad)',
  FIN_WAIT_2: 'var(--c-bad)',
  CLOSE_WAIT: 'var(--c-current)',
  LAST_ACK: 'var(--c-bad)',
  TIME_WAIT: 'var(--c-source)',
};

function StateChip({ who, state }: { who: string; state: TcpState }) {
  return (
    <div className="card" style={{ padding: '8px 12px', flex: 1, borderLeft: `5px solid ${STATE_TONE[state]}` }}>
      <div className="muted" style={{ fontSize: 14 }}>
        {who}
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
        {state}
      </div>
    </div>
  );
}

interface SimProps {
  scenarios: { key: string; label: string; build: () => ConnScenario }[];
  /** Kandidat jawaban untuk tebakan nomor ACK. */
  candidates: number[];
}

/** Simulator percakapan TCP: diagram urutan, status kedua sisi, tabel segmen, dan mode tebak nomor ACK. */
function ConnSim({ scenarios, candidates }: SimProps) {
  const [key, setKey] = useState(scenarios[0].key);
  const sc = useMemo(() => scenarios.find((x) => x.key === key)!.build(), [key, scenarios]);
  const [predict, setPredict] = useState(false);
  const [score, setScore] = useState({ ok: 0, all: 0 });
  const limitRef = useRef<number | undefined>(undefined);
  const s = useFragmentStepper(sc.steps.length, 1500, limitRef);
  const i = s.index;
  const cur = sc.steps[i];
  const next = sc.steps[i + 1];
  const nextSeg = next ? sc.segments.find((g) => g.step === i + 1 && g.ack !== undefined) : undefined;
  const needGuess = predict && !!nextSeg;
  limitRef.current = needGuess ? i : undefined;
  const options = useMemo(() => {
    const r = makeRng(i * 29 + key.length);
    const arr = [...candidates];
    for (let k = arr.length - 1; k > 0; k--) {
      const j = r.int(k + 1);
      [arr[k], arr[j]] = [arr[j], arr[k]];
    }
    return arr;
  }, [i, key, candidates]);

  const messages: SeqMessage[] = sc.segments.map((g) => ({
    id: g.id,
    from: g.from,
    to: g.to,
    t0: g.t0,
    t1: g.t1,
    lost: g.lost,
    step: g.step,
    tone: g.lost ? 'bad' : g.flags.includes('FIN') ? 'warn' : g.flags.includes('SYN') ? 'data' : 'ack',
    label: segLabel(g),
  }));
  const marks: SeqMark[] = sc.timeouts.map((x) => ({ lane: x.side, t: x.t, label: 'timeout', kind: 'timeout', step: x.step }));
  const sent = sc.segments.filter((g) => g.step <= i);

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {s.fragments}
      <div className="col" style={{ width: 600, flex: 'none' }}>
        <div className="card" style={{ padding: 6 }}>
          <SeqDiagram
            lanes={[
              { id: 'C', label: 'Klien' },
              { id: 'S', label: 'Server' },
            ]}
            messages={messages}
            marks={marks}
            tMax={sc.tMax}
            step={i}
            viewHeight={470}
            ariaLabel="Diagram urutan segmen TCP"
          />
        </div>
      </div>
      <div className="col grow">
        {scenarios.length > 1 && (
          <div className="toolbar">
            <div className="seg" role="group" aria-label="Skenario">
              {scenarios.map((x) => (
                <button
                  key={x.key}
                  className={key === x.key ? 'on' : ''}
                  aria-pressed={key === x.key}
                  onClick={() => {
                    setKey(x.key);
                    s.reset();
                  }}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        )}
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
            Mode tebak dulu (nomor ACK)
          </label>
          {predict && (
            <span className="muted" style={{ fontSize: 14 }}>
              Benar {score.ok} dari {score.all}
            </span>
          )}
                </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <StateChip who="Klien" state={cur.client} />
          <StateChip who="Server" state={cur.server} />
        </div>
        <div className="explain" aria-live="polite">
          <Rich>{cur.text}</Rich>
        </div>
        {predict && (
          <div className="explain">
            {needGuess ? (
              <GuessCard
              key={`${key}-${i}`}
              question={`Segmen berikutnya (${nextSeg!.flags.join('+')}) membawa nomor ACK berapa?`}
              options={options.map(String)}
              answer={options.indexOf(nextSeg!.ack!)}
              hint="ACK = nomor byte berikutnya yang ditunggu. SYN dan FIN masing-masing menghabiskan satu nomor urut."
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
        <StepControls s={s} unit="Langkah" blockNext={needGuess} noPlay={predict} />
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Segmen yang sudah dikirim">
            <thead>
              <tr>
                <th className="left">Dari</th>
                <th>Flag</th>
                <th>seq</th>
                <th>ack</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }, (_, k) => {
                const g = sent.slice(-4)[k];
                if (!g)
                  return (
                    <tr key={k} aria-hidden="true">
                      <td colSpan={4} />
                    </tr>
                  );
                return (
                  <tr key={g.id} className={g.step === i ? 'live' : ''}>
                    <td className="left">{g.from === 'C' ? 'Klien' : 'Server'}</td>
                    <td className={g.lost ? 'changed' : ''}>
                      {g.flags.join('+')}
                      {g.lost ? ' ✕' : ''}
                    </td>
                    <td className="mono">{g.seq}</td>
                    <td className="mono">{g.ack ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const HS = [
  { key: 'normal', label: 'Normal', build: () => buildHandshake({ isnC: 1000, isnS: 5000 }) },
  { key: 'syn', label: 'SYN hilang', build: () => buildHandshake({ isnC: 1000, isnS: 5000, loseSyn: true }) },
  { key: 'synack', label: 'SYN+ACK hilang', build: () => buildHandshake({ isnC: 1000, isnS: 5000, loseSynAck: true }) },
];
const TD = [{ key: 'td', label: 'Penutupan', build: () => buildTeardown({ seqC: 2001, seqS: 7001 }) }];

export const HandshakeLab = () => <ConnSim scenarios={HS} candidates={[1000, 1001, 5000, 5001]} />;
export const TeardownLab = () => <ConnSim scenarios={TD} candidates={[2001, 2002, 7001, 7002]} />;

/* ---------- Slide: nomor urut per byte ---------- */

export function SeqLab() {
  const [sizes, setSizes] = useState([100, 200, 50]);
  const [lose, setLose] = useState<number | undefined>(undefined);
  const rows = transferTable({ start: 1001, sizes, lose });
  const total = sizes.reduce((a, b) => a + b, 0);
  const dup = rows.find((r) => r.dupAck);

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 520, flex: 'none' }}>
        <div className="card">
          <div className="muted" style={{ fontSize: 15 }}>
            Byte pertama bernomor <Tex>{'1001'}</Tex> (setelah SYN memakai nomor <Tex>{'1000'}</Tex>)
          </div>
          {sizes.map((z, k) => (
            <label key={k} className="muted" style={{ fontSize: 17, display: 'block', margin: '8px 0' }}>
              <Rich>{`Segmen $${k + 1}$: $${z}$ byte`}</Rich>{' '}
              <input
                type="range"
                data-prevent-swipe
                min={1}
                max={1460}
                value={z}
                aria-label={`Ukuran segmen ${k + 1}`}
                onChange={(e) => setSizes((a) => a.map((x, j) => (j === k ? Number(e.target.value) : x)))}
              />
            </label>
          ))}
          <div className="toolbar">
            <span className="muted">Segmen yang hilang:</span>
            <select aria-label="Segmen yang hilang" value={lose ?? ''} onChange={(e) => setLose(e.target.value === '' ? undefined : Number(e.target.value))}>
              <option value="">tidak ada</option>
              {sizes.map((_, k) => (
                <option key={k} value={k}>
                  segmen {k + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="card" style={{ padding: '10px 12px' }}>
          <div className="muted" style={{ fontSize: 14, marginBottom: 6 }}>
            Aliran byte ({total} byte)
          </div>
          <div style={{ display: 'flex', height: 30, borderRadius: 6, overflow: 'hidden', border: '1.5px solid var(--c-border)' }} role="img" aria-label="Aliran byte per segmen">
            {sizes.map((z, k) => (
              <div key={k} style={{ width: `${(z / total) * 100}%`, background: `color-mix(in srgb, ${lose === k ? 'var(--c-bad)' : ['var(--ctp-blue)', 'var(--ctp-green)', 'var(--ctp-peach)'][k]} 35%, var(--c-surface))`, borderRight: k < 2 ? '2px solid var(--c-border)' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                {k + 1}
                {lose === k ? ' ✕' : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Nomor urut dan ACK">
            <thead>
              <tr>
                <th className="left">Segmen</th>
                <th>seq</th>
                <th>Byte</th>
                <th>ACK balasan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.index}>
                  <td className="left">{r.index + 1}</td>
                  <td className="mono">{r.seq}</td>
                  <td>{r.len}</td>
                  <td className={`mono${r.lost ? ' changed' : r.dupAck ? ' changed' : ' chosen'}`}>{r.lost ? 'hilang ✕' : r.ack + (r.dupAck ? ' (ganda)' : '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <Tex block>{'\\mathrm{ack}=\\mathrm{seq}+\\text{jumlah byte}'}</Tex>
        </div>
        <div className={`callout ${dup ? 'warn' : 'ok'}`} style={{ minHeight: 130 }} aria-live="polite">
          {dup ? (
            <>
              Segmen {rows.findIndex((r) => r.lost) + 1} hilang, jadi byte <Tex>{String(dup.ack)}</Tex> tidak pernah tiba. Segmen berikutnya memicu <b>ACK ganda</b> berisi nomor yang sama: "aku masih menunggu byte{' '}
              <Tex>{String(dup.ack)}</Tex>". Tiga ACK ganda memicu <i>fast retransmit</i>.
            </>
          ) : lose !== undefined ? (
            <>Segmen {lose + 1} hilang pada pengiriman pertama, tetapi tidak ada segmen sesudahnya yang memicu ACK ganda. Pengirim baru tahu lewat timeout.</>
          ) : (
            <>
              <b>ACK kumulatif:</b> penerima selalu menjawab dengan nomor byte berikutnya yang ia tunggu. Nomor urut menghitung <b>byte</b>, bukan segmen.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
