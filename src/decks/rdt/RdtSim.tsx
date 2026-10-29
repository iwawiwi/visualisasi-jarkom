import { useMemo, useRef, useState } from 'react';
import { type LossKey, type Protocol, type RdtSnapshot, runRdt } from '../../algorithms/rdt';
import { GuessCard } from '../../core/components/GuessCard';
import { Rich } from '../../core/components/Rich';
import { SeqDiagram, type SeqMark, type SeqMessage } from '../../core/components/SeqDiagram';
import { StepControls } from '../../core/components/StepControls';
import { type CellState, WindowStrip } from '../../core/components/WindowStrip';
import { useFragmentStepper } from '../../core/hooks/useFragmentStepper';
import { makeRng } from '../../core/rng';

interface Scenario {
  key: string;
  label: string;
  total: number;
  timeout?: number;
  loseData?: LossKey[];
  loseAck?: LossKey[];
  /** Pelajaran yang ditambahkan ke penjelasan di langkah terakhir. */
  note: string;
}

const SCENARIOS: Record<Protocol, Scenario[]> = {
  saw: [
    { key: 'normal', label: 'Normal', total: 4, note: 'Satu paket per RTT: pengirim lebih banyak menunggu daripada mengirim. (Stop-and-Wait asli cukup memakai nomor urut 1 bit, 0 dan 1; di sini dipakai 0, 1, 2, … supaya mudah dibaca.)' },
    { key: 'loss', label: 'Paket hilang', total: 4, loseData: [{ seq: 1, nth: 1 }], note: 'Tanpa ACK, timer habis, dan paket yang sama dikirim ulang.' },
    { key: 'ackloss', label: 'ACK hilang', total: 4, loseAck: [{ seq: 1, nth: 1 }], note: 'Pengirim mengira paket hilang lalu mengirim ulang. Penerima mengenali duplikat lewat nomor urut dan membuangnya.' },
    { key: 'early', label: 'Timeout pendek', total: 3, timeout: 3, note: 'Timer lebih pendek dari RTT: terjadi pengiriman ulang padahal tidak ada yang hilang. Penerima membuang duplikatnya.' },
  ],
  gbn: [
    { key: 'normal', label: 'Normal', total: 6, note: 'Empat paket terbang bersamaan: ACK pertama tiba tepat saat jendela penuh.' },
    { key: 'loss', label: 'Paket 2 hilang', total: 6, loseData: [{ seq: 2, nth: 1 }], note: 'Penerima membuang paket 3, 4, 5 yang di luar urutan. Setelah timeout, pengirim mengulang paket 2 dan semua sesudahnya.' },
    { key: 'ackloss', label: 'ACK 1 hilang', total: 6, loseAck: [{ seq: 1, nth: 1 }], note: 'ACK 2 yang tiba kemudian bersifat kumulatif, jadi menutupi ACK 1 yang hilang. Tidak ada pengiriman ulang.' },
  ],
  sr: [
    { key: 'normal', label: 'Normal', total: 6, note: 'Tanpa gangguan, SR berperilaku seperti GBN.' },
    { key: 'loss', label: 'Paket 2 hilang', total: 6, loseData: [{ seq: 2, nth: 1 }], note: 'Paket 3, 4, 5 ditahan di buffer penerima. Hanya paket 2 yang dikirim ulang, lalu semuanya diserahkan berurutan.' },
    { key: 'ackloss', label: 'ACK 2 hilang', total: 6, loseAck: [{ seq: 2, nth: 1 }], note: 'Timer paket 2 habis, paket 2 dikirim ulang. Penerima sudah menyimpannya dan hanya mengirim ACK lagi.' },
  ],
};

export const PROTOCOL_NAME: Record<Protocol, string> = { saw: 'Stop-and-Wait', gbn: 'Go-Back-N', sr: 'Selective Repeat' };

const GUESS = [
  { k: 'new', label: 'Mengirim paket baru' },
  { k: 're', label: 'Mengirim ulang paket' },
  { k: 't', label: 'Timer habis (timeout)' },
  { k: 'ack', label: 'Menerima ACK' },
];

interface Props {
  /** lesson = skenario siap pakai; sandbox = atur sendiri protokol, jendela, dan kehilangan. */
  mode: 'lesson' | 'sandbox';
  protocol?: Protocol;
}

const TOTAL_SANDBOX = 6;

export function RdtSim({ mode, protocol: fixed = 'saw' }: Props) {
  const sandbox = mode === 'sandbox';
  const [proto, setProto] = useState<Protocol>(sandbox ? 'gbn' : fixed);
  const [scKey, setScKey] = useState('normal');
  const [win, setWin] = useState(4);
  const [timeout, setTimeoutT] = useState(5);
  const [lossD, setLossD] = useState<number[]>([2]);
  const [lossA, setLossA] = useState<number[]>([]);
  const [seed, setSeed] = useState(1);
  const [predict, setPredict] = useState(false);
  const [score, setScore] = useState({ ok: 0, all: 0 });

  const scenarios = SCENARIOS[proto];
  const sc = scenarios.find((x) => x.key === scKey) ?? scenarios[0];
  const total = sandbox ? TOTAL_SANDBOX : sc.total;
  const N = proto === 'saw' ? 1 : win;

  const res = useMemo(
    () =>
      runRdt(
        sandbox
          ? { protocol: proto, total, window: N, timeout, loseData: lossD.map((seq) => ({ seq, nth: 1 })), loseAck: lossA.map((seq) => ({ seq, nth: 1 })) }
          : { protocol: proto, total, window: 4, timeout: sc.timeout, loseData: sc.loseData, loseAck: sc.loseAck },
      ),
    [sandbox, proto, total, N, timeout, lossD, lossA, sc],
  );

  const limitRef = useRef<number | undefined>(undefined);
  const s = useFragmentStepper(res.steps.length + 1, 1300, limitRef);
  const i = s.index;
  const cur = i > 0 ? res.steps[i - 1] : null;
  const next = res.steps[i];
  const blank: RdtSnapshot = useMemo(
    () => ({ base: 0, nextseq: 0, acked: Array(total).fill(false), sent: Array(total).fill(false), delivered: Array(total).fill(false), buffered: Array(total).fill(false) }),
    [total],
  );
  const snap = cur?.snap ?? blank;

  const nextMsg = next ? res.messages.find((m) => m.kind === 'data' && m.step === i) : undefined;
  const answerKey = !next ? '' : next.kind === 'timeout' ? 't' : next.kind === 'send' ? (nextMsg && nextMsg.nth > 1 ? 're' : 'new') : 'ack';
  const needGuess = predict && !sandbox && !!next && (next.kind === 'send' || next.kind === 'timeout' || next.kind === 'recv-ack');
  limitRef.current = needGuess ? i : undefined;
  const options = useMemo(() => {
    const r = makeRng(i * 53 + total);
    const arr = [...GUESS];
    for (let k = arr.length - 1; k > 0; k--) {
      const j = r.int(k + 1);
      [arr[k], arr[j]] = [arr[j], arr[k]];
    }
    return arr;
  }, [i, total]);

  const messages: SeqMessage[] = res.messages.map((m) => ({
    id: m.id,
    from: m.from,
    to: m.to,
    t0: m.t0,
    t1: m.t1,
    lost: m.lost,
    step: m.step,
    tone: m.lost ? 'bad' : m.kind === 'ack' ? 'ack' : m.nth > 1 ? 'warn' : 'data',
    label: m.kind === 'ack' ? `ACK $${m.seq}$` : `pkt $${m.seq}$${m.nth > 1 ? ' (ulang)' : ''}`,
  }));
  const marks: SeqMark[] = res.timeouts.map((x) => ({ lane: 's', t: x.t, label: 'timeout', kind: 'timeout', step: x.step }));

  const senderState = (q: number): CellState => (snap.acked[q] ? 'acked' : snap.sent[q] ? 'sent' : q < snap.base + N ? 'usable' : 'blocked');
  const receiverState = (q: number): CellState => (snap.delivered[q] ? 'received' : snap.buffered[q] ? 'buffered' : 'blocked');
  const retrans = res.messages.filter((m) => m.kind === 'data' && m.nth > 1 && m.step <= i - 1).length;

  let explain = cur ? cur.text : 'Awal: pengirim siap mengirim. Tekan Maju atau panah → untuk menjalankan satu peristiwa.';
  if (s.atEnd && cur) explain += ` ${sandbox ? '' : sc.note}`;

  const reset = () => s.reset();
  const toggle = (arr: number[], q: number) => (arr.includes(q) ? arr.filter((x) => x !== q) : [...arr, q].sort());

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {s.fragments}
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="card" style={{ padding: 6 }}>
          <SeqDiagram
            lanes={[
              { id: 's', label: 'Pengirim' },
              { id: 'r', label: 'Penerima' },
            ]}
            messages={messages}
            marks={marks}
            tMax={res.tMax}
            step={i - 1}
            viewHeight={sandbox ? 440 : 500}
            ariaLabel={`Diagram urutan pesan ${PROTOCOL_NAME[proto]}`}
          />
        </div>
        {sandbox && (
          <div className="card" style={{ padding: 8 }}>
            <table className="algo fixed" aria-label="Atur kehilangan">
              <thead>
                <tr>
                  <th className="left">Paket</th>
                  {Array.from({ length: total }, (_, q) => (
                    <th key={q}>{q}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="left">Data</td>
                  {Array.from({ length: total }, (_, q) => (
                    <td key={q}>
                      <input
                        type="checkbox"
                        aria-label={`Hilangkan paket data ${q}`}
                        checked={lossD.includes(q)}
                        onChange={() => {
                          setLossD((a) => toggle(a, q));
                          reset();
                        }}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="left">ACK</td>
                  {Array.from({ length: total }, (_, q) => (
                    <td key={q}>
                      <input
                        type="checkbox"
                        aria-label={`Hilangkan ACK ${q}`}
                        checked={lossA.includes(q)}
                        onChange={() => {
                          setLossA((a) => toggle(a, q));
                          reset();
                        }}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <div className="toolbar" style={{ marginTop: 6 }}>
              <button
                className="btn small"
                onClick={() => {
                  const r = makeRng(seed);
                  setSeed((x) => x + 1);
                  setLossD(Array.from({ length: total }, (_, q) => q).filter(() => r.chance(0.3)));
                  setLossA(Array.from({ length: total }, (_, q) => q).filter(() => r.chance(0.25)));
                  reset();
                }}
              >
                🎲 Acak kehilangan
              </button>
              <button
                className="btn small"
                onClick={() => {
                  setLossD([]);
                  setLossA([]);
                  reset();
                }}
              >
                Tanpa gangguan
              </button>
              <span className="muted" style={{ fontSize: 14 }}>
                Centang = hilang (pengiriman pertama).
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="col grow">
        {!sandbox && (
          <div className="toolbar">
            <div className="seg" role="group" aria-label="Skenario">
              {scenarios.map((x) => (
                <button
                  key={x.key}
                  className={sc.key === x.key ? 'on' : ''}
                  aria-pressed={sc.key === x.key}
                  onClick={() => {
                    setScKey(x.key);
                    setScore({ ok: 0, all: 0 });
                    reset();
                  }}
                >
                  {x.label}
                </button>
              ))}
            </div>
          {!sandbox && (
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
          )}
          {predict && !sandbox && (
            <span className="muted" style={{ fontSize: 14 }}>
              Benar {score.ok} dari {score.all}
            </span>
          )}
          </div>
        )}
        {sandbox && (
          <div className="toolbar">
            <select
              aria-label="Pilih protokol"
              value={proto}
              onChange={(e) => {
                setProto(e.target.value as Protocol);
                reset();
              }}
            >
              {(['saw', 'gbn', 'sr'] as Protocol[]).map((p) => (
                <option key={p} value={p}>
                  {PROTOCOL_NAME[p]}
                </option>
              ))}
            </select>
            <label className="muted" style={{ fontSize: 15 }}>
              Jendela <Rich>{`$N=${N}$`}</Rich>{' '}
              <input
                type="range"
                data-prevent-swipe
                min={1}
                max={5}
                value={N}
                disabled={proto === 'saw'}
                aria-label="Ukuran jendela"
                onChange={(e) => {
                  setWin(Number(e.target.value));
                  reset();
                }}
              />
            </label>
            <label className="muted" style={{ fontSize: 15 }}>
              Timeout <Rich>{`$${timeout}$`}</Rich>{' '}
              <input
                type="range"
                data-prevent-swipe
                min={3}
                max={8}
                value={timeout}
                aria-label="Batas waktu timer"
                onChange={(e) => {
                  setTimeoutT(Number(e.target.value));
                  reset();
                }}
              />
            </label>
          </div>
        )}

        <div className="card" style={{ padding: '8px 12px' }}>
          <WindowStrip
            reserveStack={1}
            count={total}
            label="Pengirim"
            window={snap.base < total ? { base: snap.base, size: Math.min(N, total - snap.base) } : undefined}
            pointers={[
              { seq: snap.base, label: 'base' },
              { seq: snap.nextseq, label: 'next' },
            ].filter((p) => p.seq < total)}
            state={senderState}
          />
          <div style={{ height: 6 }} />
          <WindowStrip count={total} label="Penerima (diserahkan ke aplikasi)" state={receiverState} stateText={{ blocked: 'belum diterima', received: 'sudah diserahkan ke aplikasi' }} />
        </div>

        <div className="explain" aria-live="polite">
          <Rich>{explain}</Rich>
        </div>
        {predict && !sandbox && (
          <div className="explain">
            {needGuess ? (
              <GuessCard
                key={`${proto}-${sc.key}-${i}`}
                question="Apa yang terjadi berikutnya di pengirim?"
                options={options.map((o) => o.label)}
                answer={options.findIndex((o) => o.k === answerKey)}
                hint="Apakah ACK yang membuka jendela tiba, atau waktu menunggu ACK sudah habis? Pengiriman ulang hanya terjadi setelah timeout."
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
        <StepControls s={s} unit="Langkah" blockNext={needGuess} noPlay={predict && !sandbox} />
        <div className="toolbar">
          <span className="muted" style={{ fontSize: 15 }}>
            <Rich>{`Waktu $t=${cur ? cur.t : 0}$`}</Rich> · pengiriman ulang: <b>{retrans}</b>
          </span>
        </div>

      </div>
    </div>
  );
}
