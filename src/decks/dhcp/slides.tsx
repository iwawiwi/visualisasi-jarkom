import { useMemo, useRef, useState } from 'react';
import { type DhcpName, type DhcpScenario, allocate, apipaAddress, buildDora, formatIp, leasePhase, leaseTimers, poolSize } from '../../algorithms/dhcp';
import { parseIp } from '../../algorithms/ipv4';
import { GuessCard } from '../../core/components/GuessCard';
import { Rich } from '../../core/components/Rich';
import { SeqDiagram, type SeqMark, type SeqMessage } from '../../core/components/SeqDiagram';
import { StepControls } from '../../core/components/StepControls';
import { Tex } from '../../core/components/Tex';
import { useFragmentStepper } from '../../core/hooks/useFragmentStepper';
import { makeRng } from '../../core/rng';

/* ---------- Slide 2: DORA ---------- */

const SCENARIOS: { key: string; label: string; servers: 0 | 1 | 2 }[] = [
  { key: 'one', label: 'Satu server', servers: 1 },
  { key: 'two', label: 'Dua server', servers: 2 },
  { key: 'none', label: 'Tanpa server (APIPA)', servers: 0 },
];
const NAMES: DhcpName[] = ['DISCOVER', 'OFFER', 'REQUEST', 'ACK'];
const NAME_ID: Record<DhcpName, string> = { DISCOVER: 'Discover', OFFER: 'Offer', REQUEST: 'Request', ACK: 'Acknowledge' };

export function DoraSim() {
  const [key, setKey] = useState('one');
  const cfg = SCENARIOS.find((x) => x.key === key)!;
  const sc: DhcpScenario = useMemo(() => buildDora(cfg.servers, 5), [cfg.servers]);
  const [predict, setPredict] = useState(false);
  const [score, setScore] = useState({ ok: 0, all: 0 });
  const limitRef = useRef<number | undefined>(undefined);
  const s = useFragmentStepper(sc.steps.length, 1600, limitRef);
  const i = s.index;
  const cur = sc.steps[i];
  const nextMsg = sc.messages.find((m) => m.step === i + 1);
  const needGuess = predict && !!nextMsg && cfg.servers > 0;
  limitRef.current = needGuess ? i : undefined;
  const options = useMemo(() => {
    const r = makeRng(i * 13 + cfg.servers);
    const a = [...NAMES];
    for (let k = a.length - 1; k > 0; k--) {
      const j = r.int(k + 1);
      [a[k], a[j]] = [a[j], a[k]];
    }
    return a;
  }, [i, cfg.servers]);

  const lanes = cfg.servers === 2 ? [{ id: 'C', label: 'Klien' }, { id: 'A', label: 'Server A' }, { id: 'B', label: 'Server B' }] : [{ id: 'C', label: 'Klien' }, { id: 'A', label: cfg.servers === 0 ? 'Tanpa server' : 'Server DHCP' }];
  // Siaran ke dua server berpangkal sama: beri label hanya pada panah pertama agar tidak bertumpuk.
  const seen = new Set<string>();
  const messages: SeqMessage[] = sc.messages.map((m) => ({
    id: m.id,
    from: m.from,
    to: m.to,
    t0: m.t0,
    t1: m.t1,
    lost: m.lost,
    step: m.step,
    tone: m.lost ? 'bad' : m.name === 'DISCOVER' || m.name === 'REQUEST' ? 'warn' : 'ack',
    label: (() => {
      const k = `${m.from}-${m.t0}`;
      const dup = seen.has(k);
      seen.add(k);
      return dup ? '' : m.name;
    })(),
  }));
  const marks: SeqMark[] = sc.marks.map((k) => ({ lane: k.lane, t: k.t, label: k.label, kind: k.kind, step: k.step }));
  // Siaran ke dua server dihitung satu pesan: satu baris tabel per (nama, pengirim, waktu kirim).
  const sent = sc.messages.filter((m) => m.step <= i).filter((m, k, a) => a.findIndex((x) => x.name === m.name && x.from === m.from && x.t0 === m.t0) === k);

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {s.fragments}
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="card" style={{ padding: 6 }}>
          <SeqDiagram lanes={lanes} messages={messages} marks={marks} tMax={sc.tMax} step={i} viewHeight={470} ariaLabel="Diagram urutan pesan DHCP" />
        </div>
      </div>
      <div className="col grow">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Skenario">
            {SCENARIOS.map((x) => (
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

          {cfg.servers > 0 && (
            <label className="check">
              <input
                type="checkbox"
                checked={predict}
                onChange={(e) => {
                  setPredict(e.target.checked);
                  if (s.playing) s.toggle();
                }}
              />
              Mode tebak dulu (pesan berikutnya)
            </label>
          )}
          {predict && cfg.servers > 0 && (
            <span className="muted" style={{ fontSize: 14 }}>
              Benar {score.ok} dari {score.all}
            </span>
          )}
                </div>
        <div className="card" style={{ padding: '8px 12px', borderLeft: `5px solid ${cur.clientIp ? 'var(--c-settled)' : 'var(--c-current)'}` }}>
          <div className="muted" style={{ fontSize: 14 }}>
            Alamat IP klien
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
            {cur.clientIp ?? '0.0.0.0 (belum punya)'}
          </div>
        </div>
        <div className="explain" aria-live="polite">
          <Rich>{cur.text}</Rich>
        </div>
        {predict && cfg.servers > 0 && (
          <div className="explain">
            {needGuess ? (
              <GuessCard
              key={`${key}-${i}`}
              question="Pesan DHCP berikutnya apa?"
              options={options.map((o) => NAME_ID[o])}
              answer={options.indexOf(nextMsg!.name)}
              hint="Ingat urutan DORA: Discover, Offer, Request, Acknowledge. Siapa yang baru saja bicara, dan apa balasannya?"
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
        <StepControls s={s} unit="Langkah" blockNext={needGuess} noPlay={predict && cfg.servers > 0} />
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Pesan yang sudah dikirim">
            <colgroup>
              <col style={{ width: 110 }} />
              <col />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="left">Pesan</th>
                <th>Sumber → tujuan</th>
                <th>Port</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }, (_, k) => {
                const m = sent.slice(-4)[k];
                if (!m)
                  return (
                    <tr key={`pad-${k}`} aria-hidden="true">
                      <td colSpan={3} />
                    </tr>
                  );
                return (
                  <tr key={`m-${m.id}`} className={m.step === i ? 'live' : ''}>
                    <td className={`left${m.lost ? ' changed' : ''}`}>
                      {m.name}
                      {m.lost ? ' ✕' : ''}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {m.srcIp} → {m.dstIp}
                    </td>
                    <td className="mono">
                      {m.srcPort}→{m.dstPort}
                    </td>
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

/* ---------- Slide 3: sewa ---------- */

const LEASES = [
  { key: '1h', label: '1 jam', secs: 3600 },
  { key: '8h', label: '8 jam', secs: 8 * 3600 },
  { key: '24h', label: '24 jam', secs: 24 * 3600 },
];
const fmtDur = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `${h} jam${m ? ` ${m} menit` : ''}` : `${m} menit`;
};

export function LeaseLab() {
  const [lk, setLk] = useState('8h');
  const [pct, setPct] = useState(30);
  const lease = LEASES.find((x) => x.key === lk)!;
  const timers = leaseTimers(lease.secs);
  const elapsed = (pct / 100) * lease.secs;
  const phase = leasePhase(lease.secs, elapsed);
  const PH = {
    bound: { tone: 'ok', title: 'Bound: alamat dipakai normal', body: 'Klien memakai alamatnya. Tidak ada pesan DHCP yang dikirim.' },
    renewing: { tone: 'warn', title: 'Renewing ($T_1$ tercapai)', body: 'Klien mengirim DHCPREQUEST langsung (unicast) ke server asalnya untuk memperpanjang sewa. Bila server menjawab ACK, hitungan sewa dimulai lagi.' },
    rebinding: { tone: 'warn', title: 'Rebinding ($T_2$ tercapai)', body: 'Server asal tidak menjawab. Klien menyiarkan DHCPREQUEST ke server DHCP mana pun yang bisa memperpanjang sewa.' },
    expired: { tone: 'bad', title: 'Sewa habis', body: 'Tidak ada yang memperpanjang. Klien harus berhenti memakai alamat itu dan mengulang dari DISCOVER.' },
  }[phase];

  return (
    <div className="col">
      <div className="toolbar">
        <span className="muted">Lama sewa:</span>
        <div className="seg" role="group" aria-label="Lama sewa">
          {LEASES.map((x) => (
            <button key={x.key} className={lk === x.key ? 'on' : ''} aria-pressed={lk === x.key} onClick={() => setLk(x.key)}>
              {x.label}
            </button>
          ))}
        </div>
        <label className="muted" style={{ fontSize: 17 }}>
          Waktu berjalan: <b style={{ color: 'var(--c-text)', display: 'inline-block', minWidth: 130 }}>{fmtDur(elapsed)}</b>{' '}
          <input type="range" data-prevent-swipe min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} aria-label="Waktu berjalan sejak sewa dimulai" />
        </label>
      </div>
      <div className="card" style={{ padding: '20px 18px 14px' }}>
        <div style={{ position: 'relative', height: 44, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--c-border)', display: 'flex' }} role="img" aria-label={`Garis waktu sewa: sekarang di fase ${phase}`}>
          <div style={{ width: '50%', background: 'var(--c-settled-soft)' }} />
          <div style={{ width: '37.5%', background: 'var(--c-current-soft)' }} />
          <div style={{ width: '12.5%', background: 'var(--c-bad-soft)' }} />
          <div style={{ position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, width: 4, background: 'var(--c-primary)', marginLeft: -2 }} aria-hidden="true" />
        </div>
        <div style={{ position: 'relative', height: 40, fontSize: 13 }} aria-hidden="true">
          <span style={{ position: 'absolute', left: 0 }}>0</span>
          <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
            <Tex>{'T_1=50\\%'}</Tex>
            <br />
            {fmtDur(timers.t1)}
          </span>
          <span style={{ position: 'absolute', left: '87.5%', transform: 'translateX(-50%)', textAlign: 'center' }}>
            <Tex>{'T_2=87{,}5\\%'}</Tex>
            <br />
            {fmtDur(timers.t2)}
          </span>
          <span style={{ position: 'absolute', right: 0, textAlign: 'right' }}>
            habis
            <br />
            {fmtDur(timers.expire)}
          </span>
        </div>
      </div>
      <div className={`callout ${PH.tone}`} style={{ minHeight: 120 }} aria-live="polite">
        <b><Rich>{PH.title}</Rich>.</b> {PH.body}
      </div>
      <div className="muted" style={{ fontSize: 15 }}>
        <Rich>{'Aturan umum: $T_1=0{,}5\\times\\text{sewa}$ dan $T_2=0{,}875\\times\\text{sewa}$. Sewa pendek cocok untuk jaringan dengan banyak perangkat datang dan pergi (kafe).'}</Rich>
      </div>
    </div>
  );
}

/* ---------- Slide 4: sandbox pool ---------- */

const POOL_BASE = parseIp('192.168.10.100')!;
const MAX_CLIENTS = 10;

interface Client {
  id: number;
  ip: string;
  apipa: boolean;
}

export function PoolSandbox() {
  const [size, setSize] = useState(4);
  const pool = useMemo(() => ({ start: POOL_BASE, end: POOL_BASE + size - 1 }), [size]);
  const [clients, setClients] = useState<Client[]>([]);
  const [next, setNext] = useState(1);
  const leases = clients.filter((c) => !c.apipa).map((c) => ({ mac: `pc-${c.id}`, ip: parseIp(c.ip)! }));
  const used = new Set(leases.map((l) => l.ip));
  const free = poolSize(pool) - used.size;

  const join = () => {
    const ip = allocate(pool, leases, `pc-${next}`);
    setClients((a) => [...a, ip === null ? { id: next, ip: apipaAddress(next), apipa: true } : { id: next, ip: formatIp(ip), apipa: false }]);
    setNext((n) => n + 1);
  };
  const resizePool = (n: number) => {
    setSize(n);
    setClients([]);
    setNext(1);
  };

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="card">
          <label className="muted" style={{ fontSize: 17, display: 'block', marginBottom: 8 }}>
            <Rich>{`Ukuran pool $${size}$ alamat ($192.168.10.100$ dst.)`}</Rich>{' '}
            <input type="range" data-prevent-swipe min={2} max={8} value={size} onChange={(e) => resizePool(Number(e.target.value))} aria-label="Ukuran pool" />
          </label>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }} role="img" aria-label={`Pool: ${used.size} terpakai, ${free} bebas`}>
            {Array.from({ length: size }, (_, k) => {
              const a = POOL_BASE + k;
              const owner = clients.find((c) => !c.apipa && parseIp(c.ip) === a);
              return (
                <div key={k} className="mono" style={{ width: 64, padding: '6px 0', textAlign: 'center', fontSize: 13, borderRadius: 7, border: '1.5px solid', borderColor: owner ? 'var(--c-settled)' : 'var(--c-border)', background: owner ? 'var(--c-settled-soft)' : 'transparent' }}>
                  .{100 + k}
                  <div style={{ fontSize: 11 }}>{owner ? `PC-${owner.id}` : 'bebas'}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="toolbar">
          <button className="btn primary" onClick={join} disabled={clients.length >= MAX_CLIENTS}>
            + Klien baru meminta alamat
          </button>
          <button
            className="btn small"
            disabled={!clients.some((c) => !c.apipa)}
            onClick={() =>
              setClients((a) => {
                const idx = a.findIndex((c) => !c.apipa);
                if (idx < 0) return a;
                const rest = a.filter((_, k) => k !== idx);
                // alamat yang dilepas dicoba lagi oleh klien APIPA tertua (klien nyata mengulang DHCP berkala)
                const retry = rest.findIndex((c) => c.apipa);
                if (retry < 0) return rest;
                const leases = rest.filter((c) => !c.apipa).map((c) => ({ mac: `pc-${c.id}`, ip: parseIp(c.ip)! }));
                const ip = allocate(pool, leases, `pc-${rest[retry].id}`);
                return ip === null ? rest : rest.map((c, k) => (k === retry ? { ...c, ip: formatIp(ip), apipa: false } : c));
              })
            }
          >
            Klien tertua melepas (release)
          </button>
          <button className="btn small" disabled={clients.length === 0} onClick={() => resizePool(size)}>
            ⟲ Reset
          </button>
        </div>
        <div className={`callout ${free === 0 ? 'bad' : 'ok'}`} style={{ minHeight: 96 }} aria-live="polite">
          {free === 0 ? (
            <>
              Pool <b>habis</b>. Klien berikutnya tidak mendapat jawaban DHCP dan jatuh ke alamat <b>APIPA</b> (169.254.x.y). Pool yang habis hanya pulih bila ada klien yang melepas alamatnya; klien APIPA mencoba DHCP lagi setelah itu.
            </>
          ) : (
            <>
              Terpakai <Tex>{String(used.size)}</Tex> dari <Tex>{String(poolSize(pool))}</Tex> alamat; sisa <Tex>{String(free)}</Tex>. Server menyewakan alamat bebas terendah.
            </>
          )}
        </div>
      </div>
      <div className="col grow">
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Daftar klien">
            <thead>
              <tr>
                <th className="left">Klien</th>
                <th>Alamat</th>
                <th>Asal</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: MAX_CLIENTS }, (_, k) => {
                const c = clients[k];
                if (!c)
                  return (
                    <tr key={`pad-${k}`} aria-hidden="true">
                      <td colSpan={3} />
                    </tr>
                  );
                return (
                  <tr key={`c-${c.id}`}>
                    <td className="left">PC-{c.id}</td>
                    <td className="mono" style={{ fontSize: 14 }}>
                      {c.ip}
                    </td>
                    <td className={c.apipa ? 'changed' : 'chosen'}>{c.apipa ? 'APIPA' : 'DHCP'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Alamat APIPA dipilih klien sendiri: tidak punya gateway, jadi hanya bisa menjangkau host lain di segmen yang sama.
        </div>
      </div>
    </div>
  );
}
