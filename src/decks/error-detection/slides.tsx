import { Fragment, useMemo, useState } from 'react';
import { bitString, bitsOf, buildGrid2D, check2D, checksum, crc, crcValid, detectAll, evenParityBit } from '../../algorithms/errorDetection';
import { BitRow } from '../../core/components/BitRow';
import { Rich } from '../../core/components/Rich';
import { StepControls } from '../../core/components/StepControls';
import { Tex } from '../../core/components/Tex';
import { useFragmentStepper } from '../../core/hooks/useFragmentStepper';

const flipAt = (bits: number[], idx: number[]) => bits.map((b, i) => (idx.includes(i) ? 1 - b : b));
const toggle = (arr: number[], i: number) => (arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i].sort((a, b) => a - b));
const hex = (n: number, w = 4) => n.toString(16).toUpperCase().padStart(w, '0');
/** Nilai heksa dalam KaTeX tegak (bukan variabel miring). */
const hx = (n: number, w = 4) => `\\mathtt{${hex(n, w)}}`;

/* ---------- Slide 2: parity tunggal ---------- */

const CHARS = [
  { ch: 'A', bits: '1000001' },
  { ch: 'C', bits: '1000011' },
  { ch: 'a', bits: '1100001' },
  { ch: 'Z', bits: '1011010' },
];

export function ParityLab() {
  const [k, setK] = useState(0);
  const [flips, setFlips] = useState<number[]>([]);
  const data = bitsOf(CHARS[k].bits);
  const sent = [...data, evenParityBit(data)];
  const got = flipAt(sent, flips);
  const ones = got.reduce((a, b) => a + b, 0);
  const ok = ones % 2 === 0;
  const hidden = flips.length > 0 && ok;

  return (
    <div className="col">
      <div className="toolbar">
        <span className="muted">Huruf:</span>
        <div className="seg" role="group" aria-label="Pilih huruf">
          {CHARS.map((c, i) => (
            <button
              key={c.ch}
              className={k === i ? 'on' : ''}
              aria-pressed={k === i}
              onClick={() => {
                setK(i);
                setFlips([]);
              }}
            >
              {c.ch}
            </button>
          ))}
        </div>
        <button className="btn small" onClick={() => setFlips([])} disabled={flips.length === 0}>
          ⟲ Pulihkan
        </button>
      </div>
      <div className="card" style={{ padding: '14px 18px', display: 'grid', gap: 12 }}>
        <BitRow bits={sent} label={`Dikirim: huruf '${CHARS[k].ch}' (7 bit) + bit parity`} role={(i) => (i === 7 ? 'subnet' : 'network')} />
        <BitRow bits={got} label="Diterima: klik bit untuk merusaknya" role={(i) => (flips.includes(i) ? 'error' : i === 7 ? 'subnet' : 'default')} onToggle={(i) => setFlips((f) => toggle(f, i))} />
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card col grow" style={{ minHeight: 120 }}>
          <div style={{ fontSize: 20 }}>
            Jumlah bit 1 yang diterima: <Tex>{String(ones)}</Tex> ({ok ? 'genap' : 'ganjil'})
          </div>
          <div style={{ fontSize: 20, marginTop: 8, fontWeight: 700, color: ok ? 'var(--c-settled)' : 'var(--c-bad)' }}>{ok ? '✓ Lolos pemeriksaan' : '✗ Error terdeteksi'}</div>
        </div>
        <div className={`callout col grow ${hidden ? 'bad' : flips.length ? 'ok' : ''}`} style={{ minHeight: 120 }} aria-live="polite">
          {flips.length === 0 && (
            <>
              Pengirim menambah <b>satu bit parity</b> agar jumlah bit 1 selalu <b>genap</b>. Penerima cukup menghitung. Coba balik satu bit.
            </>
          )}
          {flips.length > 0 && !hidden && (
            <>
              <b>Terdeteksi.</b> Jumlah error <Tex>{String(flips.length)}</Tex> ganjil, jadi paritasnya berubah. Namun parity tidak tahu <i>bit yang mana</i>.
            </>
          )}
          {hidden && (
            <>
              <b>Rusak tetapi lolos!</b> <Tex>{String(flips.length)}</Tex> bit berubah (genap), sehingga paritas kembali genap. Parity tunggal hanya mendeteksi error berjumlah <i>ganjil</i>.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 3: parity dua dimensi ---------- */

const DATA2D = [bitsOf('1011'), bitsOf('0110'), bitsOf('1110'), bitsOf('0001')];

export function Parity2D() {
  const base = useMemo(() => buildGrid2D(DATA2D), []);
  const [flips, setFlips] = useState<string[]>([]);
  const grid = base.map((row, r) => row.map((b, c) => (flips.includes(`${r},${c}`) ? 1 - b : b)));
  const res = check2D(grid);
  const flipToggle = (r: number, c: number) => setFlips((f) => (f.includes(`${r},${c}`) ? f.filter((x) => x !== `${r},${c}`) : [...f, `${r},${c}`]));
  const preset = (cells: [number, number][]) => setFlips(cells.map(([r, c]) => `${r},${c}`));

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 460, flex: 'none' }}>
        <div className="card" style={{ padding: 14 }}>
          <div role="group" aria-label="Kisi parity dua dimensi" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 40px) 30px', gap: 5, justifyContent: 'center' }}>
            {grid.map((row, r) => (
              <Fragment key={r}>
                {row.map((b, c) => {
                  const isParity = r === 4 || c === 4;
                  const role = flips.includes(`${r},${c}`) ? 'error' : isParity ? 'subnet' : 'default';
                  return (
                    <button key={`${r}${c}`} type="button" className={`bit clickable role-${role}`} style={{ width: 40, height: 40 }} aria-label={`Baris ${r + 1}, kolom ${c + 1}: ${b}`} onClick={() => flipToggle(r, c)}>
                      {b}
                    </button>
                  );
                })}
                <span key={`i${r}`} style={{ alignSelf: 'center', fontWeight: 700, color: res.badRows.includes(r) ? 'var(--c-bad)' : 'var(--c-settled)' }} aria-hidden="true">
                  {res.badRows.includes(r) ? '✗' : '✓'}
                </span>
              </Fragment>
            ))}
            {grid[0].map((_, c) => (
              <span key={`c${c}`} style={{ textAlign: 'center', fontWeight: 700, color: res.badCols.includes(c) ? 'var(--c-bad)' : 'var(--c-settled)' }} aria-hidden="true">
                {res.badCols.includes(c) ? '✗' : '✓'}
              </span>
            ))}
          </div>
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Kotak jingga = bit parity (baris dan kolom). ✓/✗ menunjukkan paritas tiap baris dan kolom.
        </div>
      </div>
      <div className="col grow">
        <div className="toolbar">
          <button className="btn small" onClick={() => preset([[1, 2]])}>
            1 bit
          </button>
          <button className="btn small" onClick={() => preset([[1, 1], [1, 2], [2, 1]])}>
            3 bit (bentuk L)
          </button>
          <button className="btn small" onClick={() => preset([[0, 0], [2, 3]])}>
            2 bit
          </button>
          <button className="btn small" onClick={() => preset([[0, 0], [0, 2], [3, 0], [3, 2]])}>
            4 bit (sudut persegi)
          </button>
          <button className="btn small" onClick={() => setFlips([])} disabled={flips.length === 0}>
            ⟲ Pulihkan
          </button>
        </div>
        <div className={`callout ${!res.detected && flips.length ? 'bad' : res.located ? 'ok' : res.detected ? 'warn' : ''}`} style={{ minHeight: 150 }} aria-live="polite">
          {flips.length === 0 && <>Klik kotak mana pun untuk merusaknya. Tiap baris dan kolom punya parity sendiri.</>}
          {res.located && flips.length > 1 && (
            <>
              <b>Awas, salah sangka.</b> Pola ini tampak seperti <i>satu</i> bit salah di baris <Tex>{String(res.located[0] + 1)}</Tex>, kolom <Tex>{String(res.located[1] + 1)}</Tex>, padahal <Tex>{String(flips.length)}</Tex> bit rusak. Bila penerima
              mengoreksinya, kerusakan justru bertambah.
              <div style={{ marginTop: 8 }}>
                <button className="btn small" onClick={() => flipToggle(res.located![0], res.located![1])}>
                  Coba koreksi bit ini
                </button>
              </div>
            </>
          )}
          {res.located && flips.length === 1 && (
            <>
              <b>Satu bit salah ditemukan:</b> baris <Tex>{String(res.located[0] + 1)}</Tex>, kolom <Tex>{String(res.located[1] + 1)}</Tex>. Lokasinya pasti, jadi bisa{' '}
              <b>dikoreksi</b> tanpa kirim ulang.
              <div style={{ marginTop: 8 }}>
                <button className="btn small primary" onClick={() => flipToggle(res.located![0], res.located![1])}>
                  Koreksi bit ini
                </button>
              </div>
            </>
          )}
          {res.detected && !res.located && (
            <>
              <b>Error terdeteksi</b>, tetapi lebih dari satu bit salah sehingga posisinya tidak bisa dipastikan. Perlu kirim ulang.
            </>
          )}
          {!res.detected && flips.length > 0 && (
            <>
              <b>Lolos!</b> <Tex>{String(flips.length)}</Tex> bit rusak membentuk sudut persegi: setiap baris dan kolom terkena dua kali, jadi paritasnya tetap genap.
            </>
          )}
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Parity 2D bisa <b>mengoreksi</b> 1 bit, atau (bila hanya mendeteksi) menangkap semua error 2 dan 3 bit. Keduanya tidak sekaligus: tiga bit berbentuk L bisa disangka satu bit.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 4: CRC ---------- */

const CRC_PRESETS = [
  { label: 'Contoh kuliah', d: '101110', g: '1001' },
  { label: '10 bit, G = 10011', d: '1101011011', g: '10011' },
  { label: '8 bit, G = 1011', d: '11100110', g: '1011' },
];
const BOX_LINES = 14;

export function CrcLab() {
  const [pk, setPk] = useState(0);
  const p = CRC_PRESETS[pk];
  const r = p.g.length - 1;
  const res = useMemo(() => crc(p.d, p.g), [p]);
  const s = useFragmentStepper(res.steps.length + 2, 1400);
  const i = s.index; // 0 = awal, 1..n = langkah XOR, n+1 = hasil
  const n = res.steps.length;
  const shown = Math.min(i, n);
  const finished = i >= n + 1;
  const [flips, setFlips] = useState<number[]>([]);
  const frame = bitsOf(res.frame);
  const got = flipAt(frame, flips);
  const valid = crcValid(bitString(got), p.g);

  const lines: { text: string; kind: 'dividend' | 'gen' | 'result' | 'rem' }[] = [{ text: p.d + '0'.repeat(r), kind: 'dividend' }];
  for (let k = 0; k < shown; k++) {
    lines.push({ text: ' '.repeat(res.steps[k].pos) + p.g, kind: 'gen' });
    lines.push({ text: res.steps[k].after, kind: 'result' });
  }
  const visible = lines.slice(-BOX_LINES);

  let explain: string;
  if (i === 0) explain = `Data $D=${p.d}$, generator $G=${p.g}$ ($r=${r}$). Tambahkan $${r}$ nol di belakang $D$, lalu bagi dengan $G$ memakai XOR (tanpa pinjaman).`;
  else if (i <= n) explain = `Bit $1$ pertama dari kiri ada di posisi $${res.steps[i - 1].pos + 1}$: XOR $G$ pada posisi itu. Hasilnya menjadi dividen berikutnya.`;
  else explain = `Sisa pembagian $R=${res.remainder}$. Frame yang dikirim adalah $D$ diikuti $R$: $${res.frame}$. Penerima membaginya dengan $G$: sisa harus nol.`;

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {s.fragments}
      <div className="col" style={{ width: 560, flex: 'none' }}>
        <div className="toolbar">
          <select
            aria-label="Pilih contoh"
            value={pk}
            onChange={(e) => {
              setPk(Number(e.target.value));
              setFlips([]);
              s.reset();
            }}
          >
            {CRC_PRESETS.map((x, k) => (
              <option key={x.label} value={k}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <div className="card" style={{ height: 14 * 26 + 24, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }} role="img" aria-label="Pembagian modulo-2">
          {visible.map((l, k) => (
            <div key={k} className="mono" style={{ fontSize: 20, lineHeight: '26px', whiteSpace: 'pre', color: l.kind === 'gen' ? 'var(--c-current)' : l.kind === 'result' ? 'var(--c-text)' : 'var(--c-check)', borderTop: l.kind === 'result' ? '1.5px solid var(--c-border)' : undefined }}>
              {l.text}
            </div>
          ))}
        </div>
      </div>
      <div className="col grow">
        <div className="explain" aria-live="polite">
          <Rich>{explain}</Rich>
        </div>
        <StepControls s={s} unit="Langkah" />
        <div className="card" style={{ padding: '10px 14px', minHeight: 116 }}>
          {finished ? (
            <>
              <BitRow bits={got} size="sm" group={32} label="Frame di penerima (klik bit untuk merusaknya)" role={(k) => (flips.includes(k) ? 'error' : k >= got.length - r ? 'subnet' : 'network')} onToggle={(k) => setFlips((f) => toggle(f, k))} />
              <div style={{ marginTop: 8, fontSize: 19, fontWeight: 700, color: valid ? 'var(--c-settled)' : 'var(--c-bad)' }}>{valid ? '✓ Sisa = 0: frame diterima' : '✗ Sisa ≠ 0: error terdeteksi, frame dibuang'}</div>
            </>
          ) : (
            <span className="muted">Selesaikan pembagian dulu (tekan Maju) untuk menguji frame di penerima.</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 5: checksum Internet ---------- */

const CS_PRESETS = [
  { label: '10 kata (header IPv4)', words: [0x4500, 0x0073, 0x0000, 0x4000, 0x4011, 0x0000, 0xc0a8, 0x0001, 0xc0a8, 0x00c7] },
  { label: '4 kata dengan carry', words: [0xf0f0, 0xaaaa, 0x1234, 0x00ff] },
];

export function ChecksumLab() {
  const [pk, setPk] = useState(0);
  const words = CS_PRESETS[pk].words;
  const res = useMemo(() => checksum(words), [words]);
  const s = useFragmentStepper(words.length + 2, 1000);
  const i = s.index;
  const added = Math.min(i, words.length);
  const done = i >= words.length + 1;
  const cur = i >= 1 && i <= words.length ? res.steps[i - 1] : null;

  let explain: string;
  if (i === 0) explain = 'Bagi data menjadi kata 16-bit lalu jumlahkan satu per satu. Bila ada carry melewati 16 bit, tambahkan lagi ke hasilnya (wraparound).';
  else if (cur) explain = cur.carry ? `Tambah $${hx(cur.word)}$: jumlah $${hx(cur.raw, 5)}$ melebihi 16 bit, carry $1$ dibawa kembali: $${hx(cur.sum)}$.` : `Tambah $${hx(cur.word)}$: jumlah berjalan $${hx(cur.sum)}$.`;
  else explain = `Jumlah akhir $${hx(res.sum)}$. Checksum adalah complement satu dari jumlah itu (semua bit dibalik): $${hx(res.checksum)}$. Penerima menjumlahkan semua kata termasuk checksum: hasilnya harus $\\mathrm{FFFF}$.`;

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {s.fragments}
      <div className="col" style={{ width: 520, flex: 'none' }}>
        <div className="toolbar">
          <select
            aria-label="Pilih contoh"
            value={pk}
            onChange={(e) => {
              setPk(Number(e.target.value));
              s.reset();
            }}
          >
            {CS_PRESETS.map((x, k) => (
              <option key={x.label} value={k}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <div className="card" style={{ padding: 6 }}>
          <table className="algo fixed" aria-label="Penjumlahan checksum">
            <thead>
              <tr>
                <th className="left">Kata</th>
                <th>Nilai (heks)</th>
                <th>Jumlah berjalan</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(...CS_PRESETS.map((x) => x.words.length)) }, (_, k) => {
                const w = words[k];
                if (w === undefined)
                  return (
                    <tr key={k} aria-hidden="true">
                      <td colSpan={3} />
                    </tr>
                  );
                const st = k < added ? res.steps[k] : null;
                return (
                  <tr key={k} className={k === i - 1 ? 'live' : ''}>
                    <td className="left">{k + 1}</td>
                    <td className="mono">{hex(w)}</td>
                    <td className={`mono${st?.carry ? ' changed' : ''}`}>{st ? hex(st.sum) + (st.carry ? ' ⟲' : '') : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="col grow">
        <div className="explain" aria-live="polite">
          <Rich>{explain}</Rich>
        </div>
        <StepControls s={s} unit="Langkah" />
        <div className="card" style={{ minHeight: 120 }}>
          {done ? (
            <>
              <div style={{ fontSize: 20 }}>
                Checksum: <b className="mono" style={{ color: 'var(--c-current)' }}>{hex(res.checksum)}</b>
              </div>
              <div className="mono muted" style={{ fontSize: 17, marginTop: 8 }}>
                <Tex>{`${hx(res.sum)}+${hx(res.checksum)}=\\mathtt{FFFF}`}</Tex>
              </div>
            </>
          ) : (
            <span className="muted">Checksum muncul setelah semua kata dijumlahkan.</span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          Dipakai oleh IP, TCP, dan UDP. Cepat dihitung perangkat lunak, tetapi lebih lemah daripada CRC.
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 6: membandingkan teknik ---------- */

const ORIGINAL = bitsOf('1001010110110010');
const PATTERNS = [
  { label: '1 bit', idx: [5] },
  { label: '2 bit', idx: [3, 12] },
  { label: '5 bit beruntun (burst)', idx: [6, 7, 8, 9, 10] },
  { label: '4 bit di sudut persegi', idx: [0, 1, 4, 5] },
  { label: 'Saling meniadakan di jumlah', idx: [2, 10] },
];
const METHODS: { key: 'parity' | 'parity2d' | 'checksum' | 'crc'; name: string; bits: number; note: string }[] = [
  { key: 'parity', name: 'Parity tunggal', bits: 1, note: 'lolos bila jumlah error genap' },
  { key: 'parity2d', name: 'Parity 2D (4 kali 4)', bits: 9, note: 'lolos bila error membentuk sudut persegi' },
  { key: 'checksum', name: 'Checksum 8 bit', bits: 8, note: 'lolos bila perubahan saling meniadakan' },
  { key: 'crc', name: 'CRC-8', bits: 8, note: 'mendeteksi semua burst sampai 8 bit' },
];

export function DetectLab() {
  const [flips, setFlips] = useState<number[]>([5]);
  const got = flipAt(ORIGINAL, flips);
  const res = detectAll(ORIGINAL, got);
  const changed = flips.length > 0;
  const missed = changed ? METHODS.filter((m) => !res[m.key]) : [];

  return (
    <div className="col">
      <div className="card" style={{ padding: '12px 18px' }}>
        <BitRow bits={got} octets={false} label="Data 16 bit: klik bit untuk merusaknya, atau pilih pola di bawah" role={(i) => (flips.includes(i) ? 'error' : 'default')} onToggle={(i) => setFlips((f) => toggle(f, i))} />
      </div>
      <div className="toolbar">
        {PATTERNS.map((p) => (
          <button key={p.label} className={`btn small${JSON.stringify(flips) === JSON.stringify(p.idx) ? ' active' : ''}`} onClick={() => setFlips(p.idx)}>
            {p.label}
          </button>
        ))}
        <button className="btn small" onClick={() => setFlips([])} disabled={!changed}>
          ⟲ Pulihkan
        </button>
      </div>
      <div className="card" style={{ padding: 6 }}>
        <table className="algo fixed" aria-label="Hasil tiap teknik">
          <thead>
            <tr>
              <th className="left">Teknik</th>
              <th>Bit tambahan</th>
              <th>Hasil</th>
              <th className="left">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {METHODS.map((m) => (
              <tr key={m.key}>
                <td className="left">{m.name}</td>
                <td>{m.bits}</td>
                <td className={changed ? (res[m.key] ? 'chosen' : 'changed') : ''}>{changed ? (res[m.key] ? '✓ terdeteksi' : '✗ lolos') : '—'}</td>
                <td className="left" style={{ fontSize: 14 }}>
                  {m.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`callout ${missed.length ? 'warn' : changed ? 'ok' : ''}`} style={{ minHeight: 72 }} aria-live="polite">
        {!changed && <>Pilih pola kerusakan. Semua teknik punya titik buta; CRC paling kuat untuk jaringan.</>}
        {changed && missed.length === 0 && <>Semua teknik mendeteksi kerusakan ini.</>}
        {missed.length > 0 && (
          <>
            Lolos dari: <b>{missed.map((m) => m.name).join(', ')}</b>. {res.crc ? 'CRC-8 tetap mendeteksinya.' : 'Bahkan CRC-8 melewatkannya.'}
          </>
        )}
      </div>
    </div>
  );
}
