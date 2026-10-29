import { useMemo, useRef, useState } from 'react';
import { fullLsdb, lsaOf, runFlooding, type FloodStep } from '../../algorithms/flooding';
import { type Graph, type NodeId, edgeKey, nodeIds, setEdgeWeight } from '../../core/graph';
import { krGraph, latihanGraph } from '../../core/presets';
import { GraphView, LegendDot, type EdgeStyle, type NodeStyle } from '../../core/components/GraphView';
import { StepControls } from '../../core/components/StepControls';
import { Tex } from '../../core/components/Tex';
import { Rich } from '../../core/components/Rich';
import { PseudoCode, type PseudoLine } from '../../core/components/PseudoCode';
import { GuessCard } from '../../core/components/GuessCard';
import { useFragmentStepper } from '../../core/hooks/useFragmentStepper';
import { makeRng } from '../../core/rng';

export type FloodMode = 'lesson' | 'all' | 'change';

const PRESETS = [
  { key: 'kr', label: 'Contoh buku: u … z', graph: krGraph, origin: 'u' },
  { key: 'latihan', label: 'Lima router: A … E', graph: latihanGraph, origin: 'A' },
] as const;

/** Jumlah baris tabel dipatok ke topologi terbesar agar tata letak tidak bergeser. */
const TABLE_ROWS = Math.max(...PRESETS.map((p) => p.graph.nodes.length));

const FLOOD_PSEUDO: PseudoLine[] = [
  { code: 'Awal: simpan LSA sendiri, kirim ke semua tetangga', kinds: ['init'], meaning: 'Router yang menyiarkan LSA mengirimnya ke semua tetangga langsung.' },
  { code: 'Saat LSA (asal, seq) tiba dari tetangga n:', kinds: ['recv'], meaning: 'Setiap pesan membawa asal LSA dan nomor urutnya.' },
  { code: '  jika seq > seq yang tersimpan untuk asal:', kinds: ['recv'], meaning: 'Nomor urut lebih besar berarti kabar ini lebih baru dari yang dimiliki router.' },
  { code: '    simpan di LSDB, kirim ke semua tetangga selain n', kinds: ['new'], meaning: 'Kabar baru disimpan lalu diteruskan ke tetangga lain (bukan kembali ke pengirim).' },
  { code: '  selain itu: buang (duplikat)', kinds: ['dup'], meaning: 'Kabar yang sudah dimiliki dibuang, sehingga flooding berhenti.' },
];

const edgeDeliveryTone = (step: FloodStep, a: NodeId, b: NodeId): EdgeStyle['tone'] | undefined => {
  const on = step.deliveries.filter((d) => (d.from === a && d.to === b) || (d.from === b && d.to === a));
  if (on.length === 0) return undefined;
  return on.some((d) => d.result !== 'duplicate') ? 'path' : 'bad';
};

/** Empat pilihan berurutan yang memuat jawaban benar; posisinya diacak (deterministik menurut `seed`). */
function guessOptions(correct: number, seed: number): number[] {
  const lo = Math.max(0, correct - 3) + makeRng(seed).int(Math.min(correct, 3) + 1);
  return [0, 1, 2, 3].map((k) => lo + k);
}

interface Props {
  /** lesson = satu router menyiarkan LSA; all = semua router menyiarkan; change = sandbox perubahan link. */
  mode: FloodMode;
}

export function FloodSim({ mode }: Props) {
  const editable = mode === 'change';
  const [key, setKey] = useState<(typeof PRESETS)[number]['key']>('kr');
  const preset = PRESETS.find((p) => p.key === key)!;
  const [graph, setGraph] = useState<Graph>(preset.graph);
  const [down, setDown] = useState<string[]>([]);
  const [origin, setOrigin] = useState<NodeId>(preset.origin);
  const [predict, setPredict] = useState(false);
  const [score, setScore] = useState({ ok: 0, all: 0 });

  const ids = useMemo(() => nodeIds(graph), [graph]);
  const seqNeeded = mode === 'change' ? 2 : 1;

  // Peta efektif: link yang diputus tidak dilewati pesan.
  const eff = useMemo<Graph>(() => ({ ...graph, edges: graph.edges.filter((e) => !down.includes(edgeKey(e.a, e.b))) }), [graph, down]);
  const changed = useMemo(
    () =>
      editable
        ? graph.edges.filter((e) => down.includes(edgeKey(e.a, e.b)) || preset.graph.edges.find((b) => edgeKey(b.a, b.b) === edgeKey(e.a, e.b))!.w !== e.w)
        : [],
    [editable, graph, down, preset],
  );
  const origins = useMemo<NodeId[]>(() => {
    if (mode === 'lesson') return [origin];
    if (mode === 'all') return ids;
    return [...new Set(changed.flatMap((e) => [e.a, e.b]))].sort();
  }, [mode, origin, ids, changed]);

  const res = useMemo(
    () => (editable ? runFlooding(eff, { origins, seq: 2, initial: fullLsdb(preset.graph, 1) }) : runFlooding(eff, { origins })),
    [editable, eff, origins, preset],
  );

  const limitRef = useRef<number | undefined>(undefined);
  const s = useFragmentStepper(res.steps.length, 1500, limitRef);
  const st = res.steps[s.index];
  const prev = res.steps[s.index - 1];
  const next = res.steps[s.index + 1];
  const needGuess = predict && mode === 'lesson' && !!next;
  // Selama menunggu tebakan, panah/spasi/geser tidak boleh melewati langkah ini.
  limitRef.current = needGuess ? s.index : undefined;
  const idle = editable && origins.length === 0;

  const has = (id: NodeId) => origins.length > 0 && origins.every((o) => (st.lsdb[id]?.[o] ?? 0) >= seqNeeded);
  const count = (id: NodeId) => origins.filter((o) => (st.lsdb[id]?.[o] ?? 0) >= seqNeeded).length;
  const recvNew = new Set(st.deliveries.filter((d) => d.result === 'new').map((d) => d.to));

  const resetAll = (g: Graph, org: NodeId) => {
    setGraph(g);
    setDown([]);
    setOrigin(org);
    setScore({ ok: 0, all: 0 });
    s.reset();
  };

  const nodeStyle = (id: NodeId): NodeStyle => {
    let role: NodeStyle['role'] = 'default';
    if (recvNew.has(id)) role = 'current';
    else if (has(id)) role = 'settled';
    else if (origins.includes(id)) role = 'source';
    const out: NodeStyle = { role };
    if (mode !== 'lesson' && origins.length > 1) {
      out.badge = `${count(id)}/${origins.length}`;
      out.badgeTone = count(id) === origins.length ? 'good' : 'normal';
    }
    return out;
  };

  const edgeStyle = (a: NodeId, b: NodeId): EdgeStyle => {
    if (down.includes(edgeKey(a, b))) return { tone: 'dim', label: 'putus', noEdit: true };
    const t = edgeDeliveryTone(st, a, b);
    return t ? { tone: t } : {};
  };

  const packets = s.index === 0 ? [] : st.deliveries.map((d, i) => ({ id: `${mode}-${key}-${res.steps.length}-${s.index}-${i}`, from: d.from, to: d.to, tone: d.result === 'duplicate' ? ('bad' as const) : ('good' as const) }));

  const active = new Set<string>(s.index === 0 ? ['init'] : ['recv', ...(st.newCount > 0 ? ['new'] : []), ...(st.dupCount > 0 ? ['dup'] : [])]);

  // LSA yang tidak sampai ke sebagian router (hanya terjadi bila jaringan terpisah).
  const unreached = origins
    .map((o) => ({ o, miss: ids.filter((id) => (st.lsdb[id]?.[o] ?? 0) < seqNeeded) }))
    .filter((x) => x.miss.length > 0);
  let explain = st.text;
  if (idle) explain = 'Belum ada perubahan. Klik − / + pada label biaya, atau klik sebuah link untuk memutusnya. Router di ujung link itu akan menyiarkan LSA baru.';
  else if (s.atEnd && editable && unreached.length > 0)
    explain += ` Jaringan terpisah: ${unreached.map((x) => `LSA $${x.o}$ tidak sampai ke ${x.miss.map((m) => `$${m}$`).join(', ')}`).join('; ')}.`;
  else if (s.atEnd && mode === 'all' && unreached.length === 0) explain += ' Semua router kini memegang LSDB yang sama.';

  const lastTotal = res.steps.at(-1)!.total;

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {s.fragments}
      <div className="col" style={{ width: 480, flex: 'none' }}>
        {(mode === 'lesson' || editable) && (
          <div className="toolbar">
            {editable && (
              <>
                <select
                  aria-label="Pilih topologi"
                  value={key}
                  onChange={(e) => {
                    const p = PRESETS.find((x) => x.key === e.target.value)!;
                    setKey(p.key);
                    resetAll(p.graph, p.origin);
                  }}
                >
                  {PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button className="btn small" onClick={() => resetAll(preset.graph, preset.origin)}>
                  Kembalikan link
                </button>
              </>
            )}
            {mode === 'lesson' && (
              <label className="muted" style={{ fontSize: 15 }}>
                LSA dari router:{' '}
                <select
                  aria-label="Pilih router penyiar"
                  value={origin}
                  onChange={(e) => {
                    setOrigin(e.target.value);
                    s.reset();
                  }}
                >
                  {ids.map((id) => (
                    <option key={id}>{id}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        <div className="card" style={{ padding: 8 }}>
          <GraphView
            graph={graph}
            nodeStyle={nodeStyle}
            edgeStyle={edgeStyle}
            packets={packets}
            onWeightChange={
              editable
                ? (a, b, w) => {
                    setGraph((g) => setEdgeWeight(g, a, b, w));
                    s.reset();
                  }
                : undefined
            }
            onEdgeClick={
              editable
                ? (a, b) => {
                    const k = edgeKey(a, b);
                    setDown((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
                    s.reset();
                  }
                : undefined
            }
            hideWeights={false}
            ariaLabel="Graf simulasi flooding LSA"
            fixedHeight={mode === 'lesson' || editable ? 300 : 322}
          />
          <div className="legend" style={{ padding: '4px 10px 6px' }}>
            <LegendDot color="var(--c-current)" label="baru menerima LSA" />
            <LegendDot color="var(--c-settled)" label="sudah punya" />
            <span className="muted" style={{ fontSize: 13 }}>
              Garis hijau = LSA baru · merah = duplikat dibuang
            </span>
          </div>
        </div>
        <div className="explain" aria-live="polite">
          {needGuess ? (
            <GuessCard
              key={`${key}-${origin}-${s.index}`}
              question="Berapa router menerima LSA baru di ronde berikutnya?"
              options={guessOptions(next.newCount, s.index * 97 + origin.charCodeAt(0)).map(String)}
              answer={guessOptions(next.newCount, s.index * 97 + origin.charCodeAt(0)).indexOf(next.newCount)}
              hint={s.index === 0 ? 'Mulai dari tetangga langsung router penyiar: mereka yang menerima lebih dulu.' : 'Cari router yang belum punya LSA tetapi bertetangga dengan router yang baru menerimanya.'}
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
        <StepControls s={s} unit="Ronde" blockNext={needGuess} noPlay={predict && mode === 'lesson'} />
        {mode === 'lesson' && (
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
        )}
      </div>

      <div className="col grow">
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="LSDB setiap router">
            <colgroup>
              <col className="c-step" />
              {ids.map((c) => (
                <col key={c} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="left">Router</th>
                {ids.map((c) => (
                  <th key={c}>
                    <Tex>{`\\mathrm{LSA}_{${c}}`}</Tex>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: TABLE_ROWS }, (_, i) => {
                const r = ids[i];
                if (!r) {
                  return (
                    <tr key={i} aria-hidden="true">
                      <td />
                      {ids.map((c) => (
                        <td key={c} />
                      ))}
                    </tr>
                  );
                }
                return (
                  <tr key={r}>
                    <td className="left">
                      <Tex>{r}</Tex>
                    </td>
                    {ids.map((c) => {
                      const v = st.lsdb[r]?.[c] ?? 0;
                      const fresh = !!prev && (prev.lsdb[r]?.[c] ?? 0) !== v;
                      return (
                        <td key={c} className={fresh ? 'changed' : v >= seqNeeded && origins.includes(c) ? 'chosen' : ''}>
                          {v > 0 ? v : ''}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Tiap sel = nomor urut LSA yang tersimpan di LSDB router itu. Pesan ronde ini: <b>{st.messages}</b> · total: <b>{st.total}</b>
          {s.atEnd && !idle && <> (akhir: {lastTotal})</>}
        </div>
        {mode === 'lesson' && <PseudoCode lines={FLOOD_PSEUDO} label="Pseudocode flooding LSA" isActive={(l) => !!l.kinds?.some((k) => active.has(k))} />}
        {mode === 'all' && (
          <div className="callout ok" style={{ minHeight: 130 }}>
            <b>{s.atEnd ? 'Hasilnya:' : 'Di akhir flooding:'}</b> setiap baris tabel (LSDB tiap router) sama persis. Karena semua router memegang peta yang sama, masing-masing bisa menjalankan{' '}
            <b>Dijkstra</b> sendiri dan hasilnya pasti konsisten. Lihat deck <a href="./dijkstra.html">Dijkstra's Link-State Routing</a>.
          </div>
        )}
        {editable && (
          <div className="card detail-card" style={{ height: 150 }}>
            {origins.length === 0 ? (
              <span className="muted">LSA baru akan tampil di sini.</span>
            ) : (
              origins.map((o) => {
                const lsa = lsaOf(eff, o, 2);
                return (
                  <div key={o} style={{ marginBottom: 6 }}>
                    <b>
                      <Rich>{`LSA $${o}$, $\\mathrm{seq}=2$:`}</Rich>
                    </b>{' '}
                    {lsa.links.length === 0 ? (
                      <span className="muted">tidak ada tetangga</span>
                    ) : (
                      <Rich>{lsa.links.map((l) => `$${o}\\text{–}${l.to}=${l.w}$`).join(',  ')}</Rich>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
        {editable && (
          <div className="muted" style={{ fontSize: 15 }}>
            Klik <b>−</b>/<b>+</b> untuk mengubah biaya, atau klik garis link untuk memutus/menyambungnya. <Rich>{'LSA lama ($\\mathrm{seq}=1$) tidak lagi dipakai setelah LSA $\\mathrm{seq}=2$ tiba.'}</Rich>
          </div>
        )}
      </div>
    </div>
  );
}

