import { useMemo, useState } from 'react';
import { runRdt, utilization } from '../../algorithms/rdt';
import { Rich } from '../../core/components/Rich';
import { SeqDiagram, type SeqMark, type SeqMessage } from '../../core/components/SeqDiagram';
import { Tex } from '../../core/components/Tex';

/* ---------- Slide 2: kanal yang tidak bisa dipercaya ---------- */

interface Problem {
  key: string;
  label: string;
  messages: SeqMessage[];
  marks: SeqMark[];
  what: string;
  tool: string;
}

const m = (id: string, from: string, to: string, t0: number, t1: number, label: string, o: Partial<SeqMessage> = {}): SeqMessage => ({ id, from, to, t0, t1, label, step: 0, ...o });

const PROBLEMS: Problem[] = [
  {
    key: 'loss',
    label: 'Paket hilang',
    messages: [m('a', 's', 'r', 1, 3, 'pkt $1$', { lost: true, tone: 'bad' })],
    marks: [{ lane: 's', t: 6, label: 'menunggu… timeout', kind: 'timeout', step: 0 }],
    what: 'Router membuang paket (antrean penuh) atau sinyal rusak. Penerima tidak tahu apa-apa; pengirim tidak mendapat kabar apa pun.',
    tool: 'Timer dan kirim ulang: bila tidak ada ACK sampai batas waktu, anggap paket hilang.',
  },
  {
    key: 'corrupt',
    label: 'Paket rusak',
    messages: [m('a', 's', 'r', 1, 3, 'pkt $1$ (rusak)', { tone: 'warn' })],
    marks: [{ lane: 'r', t: 3, label: 'checksum salah → dibuang', kind: 'note', step: 0 }, { lane: 's', t: 7, label: 'timeout', kind: 'timeout', step: 0 }],
    what: 'Beberapa bit berubah di jalan. Isi paket tidak bisa dipercaya.',
    tool: 'Checksum: penerima mendeteksi kerusakan lalu membuang paket, sehingga kasusnya sama dengan paket hilang.',
  },
  {
    key: 'ackloss',
    label: 'ACK hilang',
    messages: [m('a', 's', 'r', 1, 3, 'pkt $1$'), m('b', 'r', 's', 3, 5, 'ACK $1$', { lost: true, tone: 'bad' }), m('c', 's', 'r', 8, 10, 'pkt $1$ (ulang)', { tone: 'warn' })],
    marks: [{ lane: 's', t: 8, label: 'timeout', kind: 'timeout', step: 0 }],
    what: 'Paket sampai, tetapi kabar baiknya tidak. Pengirim mengirim ulang, jadi penerima menerima paket yang sama dua kali.',
    tool: 'Nomor urut: penerima mengenali paket 1 sudah pernah datang, membuang duplikatnya, dan hanya mengirim ACK lagi.',
  },
  {
    key: 'late',
    label: 'ACK terlambat',
    messages: [
      m('a', 's', 'r', 1, 3, 'pkt $1$'),
      m('b', 'r', 's', 3, 5, 'ACK $1$', { tone: 'ack' }),
      m('c', 's', 'r', 4, 6, 'pkt $1$ (ulang)', { tone: 'warn' }),
      m('d', 'r', 's', 6, 8, 'ACK $1$', { tone: 'ack' }),
    ],
    marks: [{ lane: 's', t: 4, label: 'timeout terlalu cepat', kind: 'timeout', step: 0 }],
    what: 'Tidak ada yang hilang, tetapi timer lebih pendek dari waktu pulang-pergi (RTT). Pengirim terburu-buru mengirim ulang.',
    tool: 'Timeout yang sesuai RTT, ditambah nomor urut supaya duplikat tidak diproses dua kali.',
  },
];

export function ChannelProblems() {
  const [k, setK] = useState('loss');
  const p = PROBLEMS.find((x) => x.key === k)!;
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="card" style={{ padding: 6 }}>
          <SeqDiagram
            lanes={[
              { id: 's', label: 'Pengirim' },
              { id: 'r', label: 'Penerima' },
            ]}
            messages={p.messages}
            marks={p.marks}
            tMax={11}
            step={0}
            viewHeight={440}
            ariaLabel={`Diagram: ${p.label}`}
          />
        </div>
      </div>
      <div className="col grow">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Jenis gangguan">
            {PROBLEMS.map((x) => (
              <button key={x.key} className={k === x.key ? 'on' : ''} aria-pressed={k === x.key} onClick={() => setK(x.key)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="callout warn" style={{ minHeight: 120 }}>
          <b>Apa yang terjadi?</b> {p.what}
        </div>
        <div className="callout ok" style={{ minHeight: 120 }}>
          <b>Solusinya:</b> {p.tool}
        </div>
        <div className="muted" style={{ fontSize: 16 }}>
          Lapisan jaringan di bawahnya hanya berjanji <i>best effort</i>. Keandalan harus dibangun di atasnya oleh protokol transport.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 3: kotak perkakas ---------- */

const PROBLEM_COLS = ['Paket rusak', 'Paket hilang', 'Duplikat', 'Pengirim menganggur'];
const TOOLS = [
  { key: 'checksum', name: 'Checksum', flags: [1, 0, 0, 0], body: 'Penerima menghitung ulang ringkasan isi paket. Beda dengan yang tertulis berarti paket rusak, lalu dibuang.' },
  { key: 'ack', name: 'ACK', flags: [0, 0, 0, 0], body: 'Kabar dari penerima: "paket $n$ sudah kuterima". Tanpa ACK, pengirim tidak punya cara tahu hasil pengirimannya.' },
  { key: 'seq', name: 'Nomor urut', flags: [0, 0, 1, 0], body: 'Setiap paket bernomor. Penerima bisa membedakan paket baru dari kiriman ulang (duplikat), dan mengurutkan paket yang tiba acak.' },
  { key: 'timer', name: 'Timer dan timeout', flags: [0, 1, 0, 0], body: 'Pengirim memulai timer saat mengirim. Bila ACK tidak datang sebelum habis, ia menyimpulkan paket atau ACK-nya hilang.' },
  { key: 'retx', name: 'Kirim ulang', flags: [1, 1, 0, 0], body: 'Menjawab timeout dengan mengirim paket yang sama lagi. Inilah yang benar-benar memperbaiki paket yang rusak atau hilang.' },
  { key: 'pipe', name: 'Jendela (pipelining)', flags: [0, 0, 0, 1], body: 'Mengirim beberapa paket sekaligus tanpa menunggu ACK satu per satu. Dipakai Go-Back-N dan Selective Repeat.' },
];

export function ToolBox() {
  const [k, setK] = useState('checksum');
  const t = TOOLS.find((x) => x.key === k)!;
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 340, flex: 'none' }}>
        <div role="group" aria-label="Perkakas keandalan" style={{ display: 'grid', gap: 8 }}>
          {TOOLS.map((x) => (
            <button key={x.key} className={`btn${k === x.key ? ' active' : ''}`} aria-pressed={k === x.key} onClick={() => setK(x.key)} style={{ textAlign: 'left', fontSize: 18 }}>
              {x.name}
            </button>
          ))}
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ minHeight: 150 }}>
          <h3 style={{ margin: '0 0 8px' }}>{t.name}</h3>
          <div style={{ fontSize: 20 }}>
            <Rich>{t.body}</Rich>
          </div>
        </div>
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Masalah yang diatasi tiap perkakas">
            <thead>
              <tr>
                <th className="left">Perkakas</th>
                {PROBLEM_COLS.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((x) => (
                <tr key={x.key} className={x.key === k ? 'live' : ''}>
                  <td className="left">{x.name}</td>
                  {x.flags.map((f, i) => (
                    <td key={i} className={f ? 'chosen' : ''}>
                      {f ? '✓' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Tidak ada satu perkakas yang cukup sendirian: keandalan lahir dari gabungan semuanya.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 5: mengapa Stop-and-Wait lambat ---------- */

const RATES = [
  { bps: 1e7, label: '10 Mbps' },
  { bps: 1e8, label: '100 Mbps' },
  { bps: 1e9, label: '1 Gbps' },
];
const L_BITS = 8000;

const fmtTime = (sec: number) => (sec < 1e-3 ? `${+(sec * 1e6).toPrecision(3)}\\,\\mu\\text{s}` : `${+(sec * 1e3).toPrecision(3)}\\,\\text{ms}`);

export function UtilCalc() {
  const [rate, setRate] = useState(2);
  const [rttMs, setRttMs] = useState(30);
  const [k, setK] = useState(0);
  const R = RATES[rate].bps;
  const N = 2 ** k;
  const rtt = rttMs / 1000;
  const tx = L_BITS / R;
  const U = utilization(L_BITS, R, rtt, N);
  const U1 = utilization(L_BITS, R, rtt, 1);
  const needN = Math.ceil((rtt + tx) / tx);
  const pct = U * 100;

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 520, flex: 'none' }}>
        <div className="card">
          <div className="muted" style={{ fontSize: 15 }}>
            Paket <Tex>{'L=8000'}</Tex> bit
          </div>
          <div className="toolbar" style={{ marginTop: 8 }}>
            <span className="muted">Kecepatan link:</span>
            <div className="seg" role="group" aria-label="Kecepatan link">
              {RATES.map((r, i) => (
                <button key={r.label} className={rate === i ? 'on' : ''} aria-pressed={rate === i} onClick={() => setRate(i)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <label className="muted" style={{ fontSize: 17, display: 'block', margin: '10px 0' }}>
            <Rich>{`Waktu pulang-pergi $\\mathrm{RTT}=${rttMs}\\,\\text{ms}$`}</Rich>{' '}
            <input type="range" data-prevent-swipe min={10} max={200} step={10} value={rttMs} onChange={(e) => setRttMs(Number(e.target.value))} aria-label="RTT dalam milidetik" />
          </label>
          <label className="muted" style={{ fontSize: 17, display: 'block' }}>
            <Rich>{`Jumlah paket di jalan (jendela) $N=${N}$`}</Rich>{' '}
            <input type="range" data-prevent-swipe min={0} max={12} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="Ukuran jendela (pangkat dua)" aria-valuetext={`N = ${N}`} />
          </label>
        </div>
        <div className="callout">
          <Tex block>{`U=\\dfrac{N\\cdot L/R}{\\mathrm{RTT}+L/R}`}</Tex>
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ minHeight: 120 }}>
          <div style={{ fontSize: 20 }}>
            Waktu kirim satu paket: <Tex>{`L/R=${fmtTime(tx)}`}</Tex>
          </div>
          <div style={{ fontSize: 20, marginTop: 8 }}>
            Utilisasi pengirim: <Tex>{`U=${pct >= 99.995 ? '100' : String(+pct.toPrecision(3)).replace('.', '{,}')}\\%`}</Tex>
          </div>
          <div className="util-bar" role="img" aria-label={`Utilisasi ${pct.toPrecision(3)} persen`}>
            <div style={{ width: `${Math.max(pct, 0.4)}%` }} />
          </div>
        </div>
        <div className={`callout ${N === 1 ? 'bad' : U >= 0.99 ? 'ok' : 'warn'}`} style={{ minHeight: 130 }}>
          {N === 1 ? (
            <>
              Stop-and-Wait ({<Tex>{'N=1'}</Tex>}): pengirim hanya sibuk <b>{String(+(U1 * 100).toPrecision(2)).replace('.', ',')}%</b> dari waktu; sisanya menunggu ACK. Link {RATES[rate].label} nyaris
              tidak terpakai.
            </>
          ) : U >= 0.99 ? (
            <>
              Dengan <Tex>{`N=${N}`}</Tex> paket di jalan, pengirim sibuk terus. Jendela minimal yang dibutuhkan: <Tex>{`N\\ge ${needN}`}</Tex>.
            </>
          ) : (
            <>
              Tiap paket tambahan di jalan menambah utilisasi. Untuk memenuhi link dibutuhkan <Tex>{`N\\ge ${needN}`}</Tex> paket sekaligus.
            </>
          )}
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Contoh buku (Kurose &amp; Ross): 1 Gbps, RTT 30 ms, paket 8000 bit → <Tex>{'U\\approx 0{,}00027'}</Tex>.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 8: GBN vs SR berdampingan ---------- */

export function GbnVsSr() {
  const [first, setFirst] = useState(2);
  const [count, setCount] = useState(1);

  const out = useMemo(() => {
    const loseData = Array.from({ length: count }, (_, i) => ({ seq: first + i, nth: 1 }));
    const run = (protocol: 'gbn' | 'sr') => {
      const r = runRdt({ protocol, total: 8, window: 4, loseData });
      return {
        retrans: r.retransmissions,
        sent: r.messages.filter((x) => x.kind === 'data').length,
        done: r.finishedAt ?? 0,
        buf: Math.max(0, ...r.steps.map((s) => s.snap.buffered.filter(Boolean).length)),
      };
    };
    return { gbn: run('gbn'), sr: run('sr') };
  }, [first, count]);

  const rows: { label: string; key: 'retrans' | 'sent' | 'done' | 'buf'; unit?: string }[] = [
    { label: 'Pengiriman ulang', key: 'retrans' },
    { label: 'Total paket data terkirim', key: 'sent' },
    { label: 'Selesai pada waktu', key: 'done' },
    { label: 'Buffer penerima (maks.)', key: 'buf' },
  ];

  return (
    <div className="col">
      <div className="toolbar">
        <label className="muted" style={{ fontSize: 17 }}>
          Paket pertama yang hilang: <b style={{ color: 'var(--c-text)' }}>{first}</b>{' '}
          <input type="range" data-prevent-swipe min={0} max={4} value={first} onChange={(e) => setFirst(Number(e.target.value))} aria-label="Paket pertama yang hilang" />
        </label>
        <div className="seg" role="group" aria-label="Jumlah paket hilang berturut-turut">
          {[1, 2, 3].map((c) => (
            <button key={c} className={count === c ? 'on' : ''} aria-pressed={count === c} onClick={() => setCount(c)}>
              {c} paket hilang
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 15 }}>
          <Rich>{'8 paket, jendela $N=4$'}</Rich>
        </span>
      </div>
      <div className="card" style={{ padding: 6 }}>
        <table className="algo fixed" aria-label="Perbandingan GBN dan SR">
          <thead>
            <tr>
              <th className="left">Ukuran</th>
              <th>Go-Back-N</th>
              <th>Selective Repeat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const g = out.gbn[r.key];
              const s = out.sr[r.key];
              const lowerBetter = r.key !== 'buf';
              return (
                <tr key={r.key}>
                  <td className="left">{r.label}</td>
                  <td className={lowerBetter && g < s ? 'chosen' : lowerBetter && g > s ? 'changed' : ''}>{g}</td>
                  <td className={lowerBetter && s < g ? 'chosen' : lowerBetter && s > g ? 'changed' : ''}>{s}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row">
        <div className="callout warn col grow" style={{ minHeight: 120 }}>
          <b>Go-Back-N</b> hanya menyimpan satu nomor di penerima, tetapi satu kehilangan memaksa pengulangan <b>semua paket sesudahnya</b>.
        </div>
        <div className="callout ok col grow" style={{ minHeight: 120 }}>
          <b>Selective Repeat</b> hanya mengulang yang hilang, dengan imbalan penerima harus <b>menahan paket di buffer</b> dan melacak ACK per paket.
        </div>
      </div>
    </div>
  );
}
