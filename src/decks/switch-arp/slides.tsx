import { useMemo, useRef, useState } from 'react';
import { type Host, type HopFrame, type SwitchFrame, type SwitchStep, BROADCAST, arpExchange, hopFrames, runSwitch } from '../../algorithms/switching';
import { GraphView, type EdgeStyle, type GraphPacket, type NodeStyle } from '../../core/components/GraphView';
import { GuessCard } from '../../core/components/GuessCard';
import { Rich } from '../../core/components/Rich';
import { SeqDiagram, type SeqMark, type SeqMessage } from '../../core/components/SeqDiagram';
import { StepControls } from '../../core/components/StepControls';
import { Tex } from '../../core/components/Tex';
import { useFragmentStepper } from '../../core/hooks/useFragmentStepper';
import { makeRng } from '../../core/rng';
import type { Graph } from '../../core/graph';

/* ---------- Topologi switch: S dengan port 1..4, port 1 menuju hub H (A dan E) ---------- */

const SW_GRAPH: Graph = {
  width: 600,
  height: 380,
  nodes: [
    { id: 'S', x: 300, y: 190 },
    { id: 'H', x: 160, y: 190 },
    { id: 'A', x: 55, y: 85 },
    { id: 'E', x: 55, y: 295 },
    { id: 'B', x: 300, y: 45 },
    { id: 'C', x: 545, y: 190 },
    { id: 'D', x: 300, y: 335 },
  ],
  edges: ['A-H', 'E-H', 'H-S', 'B-S', 'C-S', 'D-S'].map((k) => ({ a: k[0], b: k[2], w: 1 })),
};
const PORT_OF: Record<string, number> = { A: 1, E: 1, B: 2, C: 3, D: 4 };
const PORTS = [1, 2, 3, 4];
const HOSTS = ['A', 'B', 'C', 'D', 'E'];
const HUB_HOSTS = ['A', 'E'];
const PORT_HOST: Record<number, string> = { 2: 'B', 3: 'C', 4: 'D' };
const FRAMES: SwitchFrame[] = [
  { src: 'A', dst: 'C' },
  { src: 'C', dst: 'A' },
  { src: 'D', dst: 'B' },
  { src: 'B', dst: 'D' },
  { src: 'E', dst: 'A' },
  { src: 'A', dst: 'E' },
];
const ACTION_LABEL = { flood: 'Flood ke semua port lain', forward: 'Forward ke satu port', filter: 'Filter (tidak diteruskan)' } as const;

interface Hop {
  from: string;
  to: string;
  tone: GraphPacket['tone'];
  /** Jeda animasi (detik): hop berikutnya baru bergerak setelah hop sebelumnya sampai. */
  delay: number;
}

/** Jalur yang dilalui sebuah frame di topologi: dari sumber ke S, lalu ke port keluar. */
function route(st: SwitchStep): { hops: Hop[]; reached: Set<string> } {
  const hops: Hop[] = [];
  const reached = new Set<string>();
  const { src, dst } = st.frame;
  const good = (h: string): GraphPacket['tone'] => (dst === BROADCAST || h === dst ? 'good' : 'bad');
  const STEP = 0.7;
  const fromHub = HUB_HOSTS.includes(src);
  if (fromHub) {
    hops.push({ from: src, to: 'H', tone: 'info', delay: 0 }, { from: 'H', to: 'S', tone: 'info', delay: STEP });
    for (const o of HUB_HOSTS.filter((x) => x !== src)) {
      hops.push({ from: 'H', to: o, tone: good(o), delay: STEP });
      reached.add(o);
    }
  } else hops.push({ from: src, to: 'S', tone: 'info', delay: 0 });
  const outAt = fromHub ? 2 * STEP : STEP;
  for (const p of st.outPorts) {
    if (p === 1) {
      hops.push({ from: 'S', to: 'H', tone: 'info', delay: outAt });
      for (const o of HUB_HOSTS) {
        hops.push({ from: 'H', to: o, tone: good(o), delay: outAt + STEP });
        reached.add(o);
      }
    } else {
      hops.push({ from: 'S', to: PORT_HOST[p], tone: good(PORT_HOST[p]), delay: outAt });
      reached.add(PORT_HOST[p]);
    }
  }
  return { hops, reached };
}

function explainStep(st: SwitchStep): string {
  const { src, dst } = st.frame;
  let t = `Frame $${src}\\to ${dst === BROADCAST ? '\\text{semua}' : dst}$ masuk di port $${st.inPort}$. `;
  t += st.learned.isNew ? `Switch belajar: ${src} ada di port $${st.inPort}$ (entri baru). ` : st.learned.moved ? `Entri ${src} diperbarui ke port $${st.inPort}$. ` : `Entri ${src} sudah ada (port $${st.inPort}$). `;
  if (st.action === 'flood') t += dst === BROADCAST ? 'Alamat broadcast selalu di-flood ke semua port lain.' : `${dst} belum ada di tabel, jadi flood ke semua port lain ($${st.outPorts.join(',')}$).`;
  else if (st.action === 'forward') t += `${dst} ada di port $${st.outPorts[0]}$: forward hanya ke sana.`;
  else t += `${dst} berada di port yang sama dengan pengirim: frame tidak diteruskan (filter).`;
  return t;
}

export function SwitchLab({ mode }: { mode: 'lesson' | 'sandbox' }) {
  const sandbox = mode === 'sandbox';
  const [frames, setFrames] = useState<SwitchFrame[]>([]);
  const [src, setSrc] = useState('A');
  const [dst, setDst] = useState('C');
  const [predict, setPredict] = useState(false);
  const [score, setScore] = useState({ ok: 0, all: 0 });
  const limitRef = useRef<number | undefined>(undefined);
  const script = sandbox ? frames : FRAMES;
  const steps = useMemo(() => runSwitch(PORT_OF, PORTS, script), [script]);
  const s = useFragmentStepper(sandbox ? 1 : FRAMES.length + 1, 1500, limitRef);
  const shown = sandbox ? steps : steps.slice(0, s.index);
  const cur = shown[shown.length - 1];
  const next = sandbox ? undefined : steps[s.index];
  const needGuess = predict && !sandbox && !!next;
  limitRef.current = needGuess ? s.index : undefined;
  const table = cur?.table ?? {};
  const learnedOrder = Object.keys(table);
  const rt = cur ? route(cur) : { hops: [], reached: new Set<string>() };

  const options = useMemo(() => {
    const r = makeRng(s.index * 31 + 5);
    const arr = Object.keys(ACTION_LABEL) as (keyof typeof ACTION_LABEL)[];
    for (let k = arr.length - 1; k > 0; k--) {
      const j = r.int(k + 1);
      [arr[k], arr[j]] = [arr[j], arr[k]];
    }
    return arr;
  }, [s.index]);

  const nodeStyle = (id: string): NodeStyle => {
    if (id === 'S' || id === 'H') return { shape: 'switch', role: id === 'S' ? 'checking' : 'default', badge: id === 'S' ? 'switch' : 'hub' };
    const base: NodeStyle = { shape: 'host', badge: `port ${PORT_OF[id]}` };
    if (cur && id === cur.frame.src) return { ...base, role: 'source' };
    if (cur && rt.reached.has(id)) return { ...base, role: cur.frame.dst === BROADCAST || id === cur.frame.dst ? 'settled' : 'dim' };
    return base;
  };
  const edgeStyle = (a: string, b: string): EdgeStyle => {
    const on = rt.hops.filter((h) => (h.from === a && h.to === b) || (h.from === b && h.to === a));
    if (!cur || on.length === 0) return {};
    // garis merah hanya bila semua salinan yang lewat sia-sia
    return { tone: on.every((h) => h.tone === 'bad') ? 'bad' : 'path' };
  };
  const packets: GraphPacket[] = cur ? rt.hops.map((h, k) => ({ id: `${mode}-${shown.length}-${k}`, from: h.from, to: h.to, tone: h.tone, delay: h.delay })) : [];

  const counts = { flood: shown.filter((x) => x.action === 'flood').length, forward: shown.filter((x) => x.action === 'forward').length, filter: shown.filter((x) => x.action === 'filter').length };
  const explain = cur ? explainStep(cur) : sandbox ? 'Pilih pengirim dan tujuan, lalu kirim frame. Tabel switch masih kosong.' : 'Awal: tabel alamat MAC switch masih kosong. Tekan Maju untuk mengirim frame pertama.';

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {!sandbox && s.fragments}
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="card" style={{ padding: 8 }}>
          <GraphView graph={SW_GRAPH} hideWeights nodeStyle={nodeStyle} edgeStyle={edgeStyle} packets={packets} fixedHeight={340} ariaLabel="Topologi switch dengan empat port" />
        </div>
        <div className="muted" style={{ fontSize: 14 }}>
          A dan E berbagi port 1 lewat sebuah hub. Hijau = salinan sampai ke tujuan, merah = salinan sia-sia.
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Tabel alamat MAC switch">
            <thead>
              <tr>
                <th className="left">Alamat MAC</th>
                <th>Port</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: HOSTS.length }, (_, k) => {
                const mac = learnedOrder[k];
                if (!mac)
                  return (
                    <tr key={k} aria-hidden="true">
                      <td colSpan={2} />
                    </tr>
                  );
                const fresh = !!cur && cur.learned.mac === mac && (cur.learned.isNew || cur.learned.moved);
                return (
                  <tr key={mac} className={fresh ? 'live' : ''}>
                    <td className="left">
                      <Tex>{mac}</Tex>
                    </td>
                    <td className={fresh ? 'changed' : ''}>{table[mac]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="explain" aria-live="polite">
          <Rich>{explain}</Rich>
        </div>
        {predict && !sandbox && (
          <div className="explain">
            {needGuess ? (
              <GuessCard
              key={s.index}
              question={`Frame berikutnya $${next!.frame.src}\\to ${next!.frame.dst}$ masuk di port $${next!.inPort}$. Apa yang dilakukan switch?`}
              options={options.map((o) => ACTION_LABEL[o])}
              answer={options.indexOf(next!.action)}
              hint={`Frame $${next!.frame.src}\\to ${next!.frame.dst}$ di port $${next!.inPort}$. Switch belajar dari sumber dulu. Lalu: apakah tujuan sudah ada di tabel, dan di port yang sama atau berbeda?`}
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
        {sandbox ? (
          <>
            <div className="toolbar">
              <label className="muted" style={{ fontSize: 16 }}>
                Dari{' '}
                <select aria-label="Pengirim" value={src} onChange={(e) => setSrc(e.target.value)}>
                  {HOSTS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="muted" style={{ fontSize: 16 }}>
                Ke{' '}
                <select aria-label="Tujuan" value={dst} onChange={(e) => setDst(e.target.value)}>
                  {HOSTS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                  <option value={BROADCAST}>Semua (broadcast)</option>
                </select>
              </label>
              <button className="btn primary" onClick={() => setFrames((f) => [...f, { src, dst }])} disabled={src === dst || frames.length >= 30}>
                Kirim frame ▶
              </button>
              <button className="btn small" onClick={() => setFrames([])} disabled={frames.length === 0}>
                ⟲ Kosongkan tabel
              </button>
            </div>
            <div className="muted" style={{ fontSize: 15 }}>
              Dikirim: {shown.length} · flood {counts.flood} · forward {counts.forward} · filter {counts.filter}
            </div>
          </>
        ) : (
          <>
            <StepControls s={s} unit="Frame" blockNext={needGuess} noPlay={predict} />
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
                  Benar {score.ok} dari {score.all}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Slide: ARP ---------- */

const HA: Host = { name: 'A', ip: '192.168.1.10', mac: '0A:1A:2B:3C:4D:01' };
const HB: Host = { name: 'B', ip: '192.168.1.20', mac: '0A:1A:2B:3C:4D:02' };
const HC: Host = { name: 'C', ip: '192.168.1.30', mac: '0A:1A:2B:3C:4D:03' };

export function ArpLab() {
  const [cached, setCached] = useState(false);
  const ev = useMemo(() => arpExchange(HA, HB, HC, cached), [cached]);
  const s = useFragmentStepper(ev.length + 1, 1500);
  const i = s.index;
  const cur = i > 0 ? ev[i - 1] : null;
  const tOf = (e: number) => 1.5 + e * 2.2;

  const messages: SeqMessage[] = [];
  const marks: SeqMark[] = [];
  ev.forEach((e, k) => {
    const t = tOf(k);
    if (e.kind === 'lookup') marks.push({ lane: 'A', t, label: 'cek tabel ARP', kind: 'note', step: k });
    if (e.kind === 'request') {
      messages.push({ id: 'rb', from: 'A', to: 'B', t0: t, t1: t + 1.4, label: 'ARP request (broadcast)', tone: 'warn', step: k });
      messages.push({ id: 'rc', from: 'A', to: 'C', t0: t, t1: t + 1.4, label: '', tone: 'warn', step: k });
    }
    if (e.kind === 'ignore') marks.push({ lane: 'C', t, label: 'abaikan', kind: 'note', step: k });
    if (e.kind === 'learn') marks.push({ lane: 'B', t, label: 'catat MAC A', kind: 'note', step: k });
    if (e.kind === 'reply') messages.push({ id: 'rp', from: 'B', to: 'A', t0: t, t1: t + 1.4, label: 'ARP reply', tone: 'ack', step: k });
    if (e.kind === 'cache') marks.push({ lane: 'A', t, label: 'simpan MAC B', kind: 'note', step: k });
    if (e.kind === 'data') messages.push({ id: 'dt', from: 'A', to: 'B', t0: t, t1: t + 1.4, label: 'data → MAC B', tone: 'data', step: k });
  });

  const cacheA = cur?.cacheA ?? {};
  const cacheB = cur?.cacheB ?? {};
  const tableRow = (c: Record<string, string>, fresh: boolean) => {
    const e = Object.entries(c)[0];
    return (
      <tr className={fresh ? 'live' : ''}>
        <td className="mono">{e ? e[0] : ''}</td>
        <td className="mono" style={{ fontSize: 13 }}>
          {e ? e[1] : ''}
        </td>
      </tr>
    );
  };

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {s.fragments}
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="card" style={{ padding: 6 }}>
          <SeqDiagram
            lanes={[
              { id: 'A', label: 'A (.10)' },
              { id: 'B', label: 'B (.20)' },
              { id: 'C', label: 'C (.30)' },
            ]}
            messages={messages}
            marks={marks}
            tMax={tOf(ev.length) + 1}
            step={i - 1}
            viewHeight={470}
            ariaLabel="Diagram urutan ARP"
          />
        </div>
      </div>
      <div className="col grow">
        <div className="toolbar">
          <label className="check">
            <input
              type="checkbox"
              checked={cached}
              onChange={(e) => {
                setCached(e.target.checked);
                s.reset();
              }}
            />
            Tabel ARP A sudah berisi MAC B
          </label>
        </div>
        <div className="row">
          <div className="card col grow" style={{ padding: 6 }}>
            <div className="muted" style={{ fontSize: 14, padding: '2px 6px' }}>
              Tabel ARP milik A
            </div>
            <table className="algo fixed" aria-label="Tabel ARP A">
              <thead>
                <tr>
                  <th className="left">IP</th>
                  <th>MAC</th>
                </tr>
              </thead>
              <tbody>{tableRow(cacheA, cur?.kind === 'cache')}</tbody>
            </table>
          </div>
          <div className="card col grow" style={{ padding: 6 }}>
            <div className="muted" style={{ fontSize: 14, padding: '2px 6px' }}>
              Tabel ARP milik B
            </div>
            <table className="algo fixed" aria-label="Tabel ARP B">
              <thead>
                <tr>
                  <th className="left">IP</th>
                  <th>MAC</th>
                </tr>
              </thead>
              <tbody>{tableRow(cacheB, cur?.kind === 'learn')}</tbody>
            </table>
          </div>
        </div>
        <div className="explain" aria-live="polite">
          <Rich>{cur ? cur.text : 'A tahu IP tujuan, tetapi frame Ethernet butuh alamat MAC. ARP menerjemahkan IP menjadi MAC. Tekan Maju.'}</Rich>
        </div>
        <StepControls s={s} unit="Langkah" />
        <div className="muted" style={{ fontSize: 15 }}>
          ARP hanya bekerja di dalam satu subnet: permintaannya berupa siaran yang tidak diteruskan router.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide: antar subnet lewat router ---------- */

const HOP_GRAPH: Graph = {
  width: 600,
  height: 220,
  nodes: [
    { id: 'A', x: 50, y: 110 },
    { id: 'S1', x: 175, y: 110 },
    { id: 'R', x: 300, y: 110 },
    { id: 'S2', x: 425, y: 110 },
    { id: 'B', x: 550, y: 110 },
  ],
  edges: ['A-S1', 'S1-R', 'R-S2', 'S2-B'].map((k) => ({ a: k.split('-')[0], b: k.split('-')[1], w: 1 })),
};
const SRC = { name: 'A', ip: '192.168.1.10', mac: '0A:1A:2B:3C:4D:01' };
const DST = { name: 'B', ip: '192.168.2.20', mac: '0A:1A:2B:3C:4D:02' };
const RTR = { inIf: { mac: 'C0:FF:EE:00:00:A1' }, outIf: { mac: 'C0:FF:EE:00:00:B1' } };
const FIELDS: { key: keyof HopFrame; label: string; same: boolean }[] = [
  { key: 'srcIp', label: 'IP sumber', same: true },
  { key: 'dstIp', label: 'IP tujuan', same: true },
  { key: 'srcMac', label: 'MAC sumber', same: false },
  { key: 'dstMac', label: 'MAC tujuan', same: false },
  { key: 'ttl', label: 'TTL', same: false },
];
const MAC_NAMES: { mac: string; label: string }[] = [
  { mac: SRC.mac, label: 'MAC A' },
  { mac: RTR.inIf.mac, label: 'MAC router (sisi A)' },
  { mac: DST.mac, label: 'MAC B' },
  { mac: RTR.outIf.mac, label: 'MAC router (sisi B)' },
];

export function RouterHops() {
  const frames = useMemo(() => hopFrames(SRC, DST, [RTR]), []);
  const [predict, setPredict] = useState(false);
  const limitRef = useRef<number | undefined>(undefined);
  const s = useFragmentStepper(4, 1700, limitRef);
  const i = s.index;
  const needGuess = predict && i === 2;
  limitRef.current = needGuess ? 2 : undefined;
  const options = useMemo(() => {
    const r = makeRng(11);
    const a = [...MAC_NAMES];
    for (let k = a.length - 1; k > 0; k--) {
      const j = r.int(k + 1);
      [a[k], a[j]] = [a[j], a[k]];
    }
    return a;
  }, []);

  const texts = [
    'A ($192.168.1.10$) ingin mengirim ke B ($192.168.2.20$). Subnet berbeda, jadi A mengirim ke gateway-nya (router), dengan MAC tujuan $\\text{MAC router sisi A}$ (didapat lewat ARP).',
    'Frame 1 tiba di router. Alamat IP tujuan tetap $192.168.2.20$, tetapi MAC tujuan adalah milik router.',
    'Router melepas header Ethernet, melihat IP tujuan, mengurangi TTL, lalu mencari rute: B ada di sisi lain. Ia membuat frame baru untuk segmen berikutnya.',
    'Frame 2 tiba di B. IP sumber dan tujuan tidak berubah selama perjalanan; MAC sumber dan tujuan berganti di tiap hop.',
  ];

  const packets: GraphPacket[] =
    i === 1
      ? [
          { id: 'h1a', from: 'A', to: 'S1', tone: 'good' },
          { id: 'h1b', from: 'S1', to: 'R', tone: 'good', delay: 0.7 },
        ]
      : i === 3
        ? [
            { id: 'h3a', from: 'R', to: 'S2', tone: 'info' },
            { id: 'h3b', from: 'S2', to: 'B', tone: 'info', delay: 0.7 },
          ]
        : [];

  const cell = (f: HopFrame | undefined, key: keyof HopFrame) => (f ? String(f[key]) : '');
  const f1 = i >= 1 ? frames[0] : undefined;
  const f2 = i >= 3 ? frames[1] : undefined;

  return (
    <div className="col">
      {s.fragments}
      <div className="card" style={{ padding: 8 }}>
        <GraphView
          graph={HOP_GRAPH}
          hideWeights
          fixedHeight={170}
          packets={packets}
          nodeStyle={(id) => ({ shape: id === 'A' || id === 'B' ? 'host' : id.startsWith('S') ? 'switch' : 'router', badge: id === 'R' ? 'router' : undefined, role: id === 'A' && i < 3 ? 'source' : id === 'B' && i >= 3 ? 'settled' : 'default' })}
          ariaLabel="Dua subnet dihubungkan sebuah router"
        />
      </div>
      <div className="card" style={{ padding: 6 }}>
        <table className="algo fixed" aria-label="Isi header per segmen">
          <thead>
            <tr>
              <th className="left">Bidang</th>
              <th>Frame 1: A → router</th>
              <th>Frame 2: router → B</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f) => (
              <tr key={f.key}>
                <td className="left">{f.label}</td>
                <td className="mono" style={{ fontSize: 14 }}>
                  {cell(f1, f.key)}
                </td>
                <td className={`mono${f2 ? (f.same ? ' chosen' : ' changed') : ''}`} style={{ fontSize: 14 }}>
                  {cell(f2, f.key)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="explain" aria-live="polite">
        {needGuess ? (
          <GuessCard
            key="g"
            question="Router melepas header Ethernet, melihat IP tujuan, mengurangi TTL, lalu membuat frame baru untuk segmen berikutnya. Apa MAC tujuan frame baru itu?"
            options={options.map((o) => o.label)}
            answer={options.findIndex((o) => o.mac === DST.mac)}
            hint="Frame 2 akan dibaca langsung oleh hop berikutnya, yaitu penerima akhir."
            onResolve={() => {
              limitRef.current = undefined; // lepas batas dulu, baru maju
              s.next();
            }}
          />
        ) : (
          <Rich>{texts[i]}</Rich>
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
          Mode tebak dulu (MAC tujuan frame 2)
        </label>
      </div>
    </div>
  );
}
