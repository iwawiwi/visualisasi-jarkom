import { useMemo, useState } from 'react';
import { lsaOf, runFlooding } from '../../algorithms/flooding';
import { type Graph, type NodeId, edgeKey, nodeIds } from '../../core/graph';
import { krGraph } from '../../core/presets';
import { GraphView, LegendDot } from '../../core/components/GraphView';
import { TimeChart } from '../../core/components/TimeChart';
import { Tex } from '../../core/components/Tex';
import { Rich } from '../../core/components/Rich';

/* ---------- Slide 2: satu router = satu LSA ---------- */

export function LsaCard() {
  const [sel, setSel] = useState<NodeId>('u');
  const lsa = lsaOf(krGraph, sel);
  const nbr = new Set(lsa.links.map((l) => l.to));

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 600, flex: 'none' }}>
        <div className="card" style={{ padding: 8 }}>
          <GraphView
            graph={krGraph}
            onNodeClick={setSel}
            nodeStyle={(id) => ({ role: id === sel ? 'source' : nbr.has(id) ? 'checking' : 'dim' })}
            edgeStyle={(a, b) => (a === sel || b === sel ? { tone: 'path' } : { tone: 'dim' })}
            ariaLabel="Pilih router untuk melihat LSA-nya"
          />
          <div className="legend" style={{ padding: '4px 10px 6px' }}>
            <LegendDot color="var(--c-source)" label="router yang dipilih" />
            <LegendDot color="var(--c-check)" label="tetangga langsung" />
          </div>
        </div>
      </div>
      <div className="col grow">
        <div className="callout">
          Setiap router hanya tahu <b>link miliknya sendiri</b>. Ia merangkumnya dalam satu pesan bernama <b>LSA</b> (<i>Link-State Advertisement</i>). Klik router
          lain di graf.
        </div>
        <div className="card detail-card" style={{ height: 190 }}>
          <h3 style={{ margin: '0 0 6px' }}>
            <Rich>{`LSA milik $${sel}$`}</Rich>
          </h3>
          <table className="algo" aria-label={`Isi LSA ${sel}`}>
            <tbody>
              <tr>
                <td className="left muted">Asal</td>
                <td className="left">
                  <Tex>{sel}</Tex>
                </td>
              </tr>
              <tr>
                <td className="left muted">Nomor urut</td>
                <td className="left">
                  <Tex>{String(lsa.seq)}</Tex>
                </td>
              </tr>
              <tr>
                <td className="left muted">Link</td>
                <td className="left">
                  <Rich>{lsa.links.map((l) => `$c(${sel},${l.to})=${l.w}$`).join(',  ')}</Rich>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="callout warn">
          LSA hanya berisi <b>tetangga langsung</b>, bukan seluruh peta. Peta lengkap baru terbentuk bila <b>semua</b> LSA sampai ke <b>semua</b> router, dan itu
          tugas <i>flooding</i>.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 4: mengapa perlu nomor urut ---------- */

const MAX_ROUND = 6;

export function SeqCompare() {
  const [origin, setOrigin] = useState<NodeId>('u');
  const [upTo, setUpTo] = useState(MAX_ROUND);

  const { withSeq, withoutSeq } = useMemo(() => {
    const per = (useSeq: boolean) => {
      const r = runFlooding(krGraph, { origins: [origin], useSeq, maxRounds: MAX_ROUND });
      return Array.from({ length: MAX_ROUND + 1 }, (_, i) => r.steps[i]?.messages ?? 0);
    };
    return { withSeq: per(true), withoutSeq: per(false) };
  }, [origin]);

  const sum = (a: number[]) => a.slice(0, upTo + 1).reduce((x, y) => x + y, 0);
  const peak = Math.max(...withoutSeq);
  const yMax = Math.max(10, Math.ceil(peak / 10) * 10);
  const doneRound = withSeq.reduce((last, v, i) => (v > 0 ? i : last), 0);

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 600, flex: 'none' }}>
        <div className="card" style={{ padding: 10 }}>
          <div className="legend" style={{ paddingBottom: 4 }}>
            <LegendDot color="var(--c-settled)" label="dengan nomor urut" />
            <LegendDot color="var(--c-bad)" label="tanpa nomor urut" />
          </div>
          <TimeChart
            xMax={MAX_ROUND}
            yMax={yMax}
            xTicks={[0, 1, 2, 3, 4, 5, 6]}
            xLabel="ronde"
            yLabel="pesan yang tiba pada ronde itu"
            cursor={upTo}
            ariaLabel="Jumlah pesan per ronde dengan dan tanpa nomor urut"
            viewHeight={330}
            series={[
              { label: 'noseq', color: 'var(--c-bad)', values: withoutSeq.slice(0, upTo + 1) },
              { label: 'seq', color: 'var(--c-settled)', values: withSeq.slice(0, upTo + 1) },
            ]}
          />
        </div>
        <div className="toolbar">
          <label className="muted" style={{ fontSize: 15 }}>
            LSA dari router:{' '}
            <select aria-label="Pilih router penyiar" value={origin} onChange={(e) => setOrigin(e.target.value)}>
              {nodeIds(krGraph).map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="muted" style={{ fontSize: 15 }}>
            Sampai ronde {upTo}{' '}
            <input type="range" data-prevent-swipe min={1} max={MAX_ROUND} value={upTo} onChange={(e) => setUpTo(Number(e.target.value))} aria-label="Sampai ronde ke berapa" />
          </label>
        </div>
      </div>
      <div className="col grow">
        <div className="callout ok">
          <b>Dengan nomor urut:</b> setiap router hanya meneruskan LSA yang <i>baru</i>. Pesan habis pada ronde <b>{doneRound}</b>, total <b>{withSeq.reduce((x, y) => x + y, 0)}</b> pesan.
        </div>
        <div className="callout bad">
          <b>Tanpa nomor urut:</b> router tidak bisa mengenali kabar yang sudah pernah ia terima, jadi pesan berputar di loop jaringan. Sampai ronde {upTo} sudah{' '}
          <b>{sum(withoutSeq)}</b> pesan, dan masih bertambah.
        </div>
        <div className="card">
          <Rich>{'Nomor urut juga menolak kabar basi: LSA $x$ bernomor $2$ menggantikan yang bernomor $1$, tetapi LSA bernomor $1$ yang datang terlambat dibuang.'}</Rich>
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 7: biaya OSPF ---------- */

const REFS = [
  { mbps: 100, label: '100 Mbps (bawaan)' },
  { mbps: 1000, label: '1 Gbps' },
  { mbps: 10000, label: '10 Gbps' },
];
const IFACES = [
  { name: 'Ethernet', mbps: 10 },
  { name: 'FastEthernet', mbps: 100 },
  { name: 'GigabitEthernet', mbps: 1000 },
  { name: '10-Gigabit', mbps: 10000 },
];
const ospfCost = (refMbps: number, bwMbps: number) => Math.max(1, Math.floor(refMbps / bwMbps));

export function OspfCost() {
  const [ref, setRef] = useState(100);
  const gig = ospfCost(ref, 1000);
  const fast = ospfCost(ref, 100);
  const a = gig * 2; // jalur A: dua link Gigabit
  const b = fast; // jalur B: satu link FastEthernet
  const winner = a < b ? 'A' : b < a ? 'B' : 'sama';

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="card">
          <Tex block>{'\\text{cost}=\\max\\!\\left(1,\\ \\left\\lfloor \\dfrac{\\text{bandwidth referensi}}{\\text{bandwidth link}} \\right\\rfloor\\right)'}</Tex>
        </div>
        <div className="toolbar">
          <span className="muted">Bandwidth referensi:</span>
          <div className="seg" role="group" aria-label="Bandwidth referensi">
            {REFS.map((r) => (
              <button key={r.mbps} className={ref === r.mbps ? 'on' : ''} aria-pressed={ref === r.mbps} onClick={() => setRef(r.mbps)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Biaya OSPF per jenis link">
            <thead>
              <tr>
                <th className="left">Link</th>
                <th>Bandwidth</th>
                <th>Biaya</th>
              </tr>
            </thead>
            <tbody>
              {IFACES.map((f) => {
                const c = ospfCost(ref, f.mbps);
                const tie = IFACES.some((o) => o !== f && ospfCost(ref, o.mbps) === c);
                return (
                  <tr key={f.name}>
                    <td className="left">{f.name}</td>
                    <td>{f.mbps >= 1000 ? `${f.mbps / 1000} Gbps` : `${f.mbps} Mbps`}</td>
                    <td className={tie ? 'changed' : 'chosen'}>{c}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Jingga = biayanya <b>sama</b> dengan jenis link lain, sehingga OSPF tidak bisa membedakan kecepatannya.
        </div>
      </div>
      <div className="col grow">
        <div className="card">
          <b>Dua jalur menuju jaringan yang sama</b>
          <ul style={{ fontSize: 19, margin: '8px 0 0' }}>
            <li>
              Jalur A: dua link Gigabit → <Tex>{`${gig}+${gig}=${a}`}</Tex>
            </li>
            <li>
              Jalur B: satu link FastEthernet → <Tex>{String(b)}</Tex>
            </li>
          </ul>
        </div>
        <div className={`callout ${winner === 'A' ? 'ok' : 'bad'}`} style={{ minHeight: 120 }}>
          {winner === 'A' && (
            <>
              OSPF memilih <b>jalur A</b> (<Rich>{`biaya $${a}<${b}$`}</Rich>): jalur yang memang lebih cepat.
            </>
          )}
          {winner === 'B' && (
            <>
              OSPF memilih <b>jalur B</b> (<Rich>{`biaya $${b}<${a}$`}</Rich>), padahal FastEthernet <b><Rich>{'$10\\times$ lebih lambat'}</Rich></b>. Karena Gigabit dan FastEthernet
              sama-sama berbiaya <Tex>1</Tex>, OSPF mengira dua langkah Gigabit lebih mahal. Naikkan bandwidth referensi.
            </>
          )}
          {winner === 'sama' && <>Biayanya seri; OSPF membagi beban di kedua jalur.</>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 8: DR / BDR ---------- */

const circleGraph = (n: number, dr: 'tanpa' | 'dengan'): Graph => {
  const nodes = Array.from({ length: n }, (_, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { id: `R${i + 1}`, x: 260 + 150 * Math.cos(ang), y: 190 + 140 * Math.sin(ang) };
  });
  const edges: Graph['edges'] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) if (dr === 'tanpa' || i < 2) edges.push({ a: nodes[i].id, b: nodes[j].id, w: 1 });
  return { nodes, edges, width: 520, height: 380 };
};

export function DrBdr() {
  const [n, setN] = useState(5);
  const [mode, setMode] = useState<'tanpa' | 'dengan'>('tanpa');
  const g = useMemo(() => circleGraph(n, mode), [n, mode]);
  const full = (n * (n - 1)) / 2;
  const withDr = 2 * n - 3;

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 540, flex: 'none' }}>
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Pemilihan DR/BDR">
            <button className={mode === 'tanpa' ? 'on' : ''} aria-pressed={mode === 'tanpa'} onClick={() => setMode('tanpa')}>
              Tanpa DR/BDR
            </button>
            <button className={mode === 'dengan' ? 'on' : ''} aria-pressed={mode === 'dengan'} onClick={() => setMode('dengan')}>
              Dengan DR/BDR
            </button>
          </div>
          <label className="muted" style={{ fontSize: 15 }}>
            <Rich>{`Router: $${n}$`}</Rich>{' '}
            <input type="range" data-prevent-swipe min={3} max={8} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Jumlah router di segmen" />
          </label>
        </div>
        <div className="card" style={{ padding: 8 }}>
          <GraphView
            graph={g}
            hideWeights
            fixedHeight={380}
            nodeStyle={(id) =>
              mode === 'dengan'
                ? { role: id === 'R1' ? 'source' : id === 'R2' ? 'checking' : 'default', badge: id === 'R1' ? 'DR' : id === 'R2' ? 'BDR' : undefined }
                : {}
            }
            edgeStyle={(a, b) => (mode === 'dengan' && edgeKey(a, b) === 'R1-R2' ? { tone: 'path' } : {})}
            ariaLabel="Adjacency antar router di satu segmen"
          />
        </div>
      </div>
      <div className="col grow">
        <div className="card">
          <div style={{ fontSize: 20 }}>
            Tanpa DR/BDR: <Tex>{`\\dfrac{n(n-1)}{2}=${full}`}</Tex> adjacency
          </div>
          <div style={{ fontSize: 20, marginTop: 8 }}>
            Dengan DR/BDR: <Tex>{`2(n-2)+1=${withDr}`}</Tex> adjacency
          </div>
        </div>
        <div className={`callout ${mode === 'dengan' ? 'ok' : 'warn'}`} style={{ minHeight: 120 }}>
          {mode === 'tanpa' ? (
            <>
              Setiap pasang router harus saling bertukar LSA. Jumlahnya tumbuh <b>kuadrat</b>: menambah satu router menambah <Tex>{String(n)}</Tex> adjacency baru.
            </>
          ) : (
            <>
              Router lain hanya berhubungan dengan <b>DR</b> (Designated Router) dan <b>BDR</b> (cadangan). DR yang meneruskan LSA ke semua; jumlahnya tumbuh{' '}
              <b>linear</b>.
            </>
          )}
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Geser jumlah router: selisih kedua cara makin besar. Pada 5 router: <b>10</b> lawan <b>7</b>.
        </div>
      </div>
    </div>
  );
}
