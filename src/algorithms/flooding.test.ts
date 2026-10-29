import { describe, expect, it } from 'vitest';
import { emptyLsdb, fullLsdb, lsaOf, lsdbHas, runFlooding } from './flooding';
import { krGraph, latihanGraph } from '../core/presets';
import { nodeIds, setEdgeWeight, type Graph } from '../core/graph';
import { makeRng } from '../core/rng';

describe('Flooding LSA — graf Kurose & Ross dari u', () => {
  const res = runFlooding(krGraph, { origins: ['u'] });
  const key = (d: { from: string; to: string; result: string }) => `${d.from}>${d.to}:${d.result}`;

  it('menyebar dalam 3 ronde dengan 15 pesan (2m − (n − 1))', () => {
    expect(res.steps.map((s) => s.messages)).toEqual([0, 3, 9, 3]);
    expect(res.total).toBe(15);
    expect(res.capped).toBe(false);
  });

  it('ronde 1: tiga tetangga u menerima LSA baru', () => {
    expect(res.steps[1].deliveries.map(key)).toEqual(['u>v:new', 'u>w:new', 'u>x:new']);
  });

  it('ronde 2: y dan z baru tahu, sisanya duplikat', () => {
    const d = res.steps[2].deliveries;
    expect(d.filter((x) => x.result === 'new').map((x) => x.to).sort()).toEqual(['y', 'z']);
    expect(d.filter((x) => x.result === 'duplicate')).toHaveLength(7);
    // pesan dalam satu ronde diproses menurut urutan pengirim (abjad): w lebih dulu, kiriman x menjadi duplikat
    expect(d.filter((x) => x.to === 'y').map(key)).toEqual(['w>y:new', 'x>y:duplicate']);
  });

  it('di akhir semua router memegang LSA u', () => {
    expect(lsdbHas(res.lsdb, ['u'])).toBe(true);
    expect(res.steps[2].newCount).toBe(2);
    expect(Object.values(res.steps[3].lsdb).every((r) => r.u === 1)).toBe(true);
  });
});

describe('Flooding semua router', () => {
  it('setiap router akhirnya punya peta lengkap; total = n(2m − (n − 1))', () => {
    const ids = nodeIds(krGraph);
    const res = runFlooding(krGraph, { origins: ids });
    expect(res.lsdb).toEqual(fullLsdb(krGraph));
    expect(res.total).toBe(ids.length * (2 * krGraph.edges.length - (ids.length - 1)));
  });
});

describe('Nomor urut LSA', () => {
  it('LSA bernomor lebih baru menggantikan yang lama; yang lama tidak berpengaruh', () => {
    const changed = setEdgeWeight(krGraph, 'x', 'y', 7);
    const res = runFlooding(changed, { origins: ['x', 'y'], seq: 2, initial: fullLsdb(krGraph, 1) });
    expect(Object.values(res.lsdb).every((r) => r.x === 2 && r.y === 2)).toBe(true);
    expect(Object.values(res.lsdb).every((r) => r.u === 1 && r.z === 1)).toBe(true);
    expect(lsaOf(changed, 'x', 2).links.find((l) => l.to === 'y')!.w).toBe(7);
  });

  it('LSA lama (seq 1) tidak menimpa LSDB yang sudah memegang seq 2', () => {
    const initial = fullLsdb(krGraph, 2);
    const stale = runFlooding(krGraph, { origins: ['u'], seq: 1, initial });
    expect(stale.steps.slice(1).every((s) => s.newCount === 0)).toBe(true);
    expect(stale.lsdb).toEqual(initial); // termasuk LSA u milik u sendiri tetap seq 2
  });

  it('mode perubahan: k penyiar, total = k·(2m′ − (n − 1)) pada peta baru', () => {
    const down = { ...krGraph, edges: krGraph.edges.filter((e) => !(e.a === 'x' && e.b === 'y')) };
    const res = runFlooding(down, { origins: ['x', 'y'], seq: 2, initial: fullLsdb(krGraph, 1) });
    const n = down.nodes.length;
    expect(res.total).toBe(2 * (2 * down.edges.length - (n - 1)));
    expect(lsdbHas(res.lsdb, ['x', 'y'], 2)).toBe(true);
  });

  it('graf terpisah: berhenti normal, router di seberang tidak menerima', () => {
    const split: Graph = {
      nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, x: 0, y: 0 })),
      edges: [
        { a: 'a', b: 'b', w: 1 },
        { a: 'c', b: 'd', w: 1 },
      ],
      width: 1,
      height: 1,
    };
    const res = runFlooding(split, { origins: ['a'] });
    expect(res.capped).toBe(false);
    expect(res.lsdb.b.a).toBe(1);
    expect(res.lsdb.c.a ?? 0).toBe(0);
    expect(res.lsdb.d.a ?? 0).toBe(0);
    expect(runFlooding(split, { origins: ['a'] }).steps[0].text).toContain('1 tetangga');
  });

  it('jumlah ronde = eksentrisitas + 1 dan ronde terakhir hanya berisi duplikat', () => {
    const res = runFlooding(krGraph, { origins: ['u'] });
    expect(res.steps.length - 1).toBe(3);
    expect(res.steps.at(-1)!.newCount).toBe(0);
  });

  it('tanpa nomor urut pesan terus berputar sampai dihentikan batas ronde', () => {
    const res = runFlooding(krGraph, { origins: ['u'], useSeq: false });
    expect(res.capped).toBe(true);
    expect(res.steps).toHaveLength(7);
    expect(res.steps.at(-1)!.messages).toBeGreaterThan(res.steps[3].messages);
  });
});

describe('Flooding pada graf acak terhubung', () => {
  const randomGraph = (rng: ReturnType<typeof makeRng>): Graph => {
    const n = 3 + rng.int(6);
    const nodes = Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(97 + i), x: 0, y: 0 }));
    const edges: Graph['edges'] = [];
    for (let i = 1; i < n; i++) edges.push({ a: nodes[rng.int(i)].id, b: nodes[i].id, w: 1 + rng.int(9) });
    for (let k = 0; k < n; k++) {
      const a = nodes[rng.int(n)].id;
      const b = nodes[rng.int(n)].id;
      if (a !== b && !edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) edges.push({ a, b, w: 1 + rng.int(9) });
    }
    return { nodes, edges, width: 1, height: 1 };
  };

  it('LSDB lengkap, pesan per LSA = 2m − (n − 1), tak ada yang diterima baru dua kali', () => {
    const rng = makeRng(2024);
    for (let t = 0; t < 200; t++) {
      const g = randomGraph(rng);
      const n = g.nodes.length;
      const origin = g.nodes[rng.int(n)].id;
      const res = runFlooding(g, { origins: [origin] });
      expect(lsdbHas(res.lsdb, [origin])).toBe(true);
      expect(res.total).toBe(2 * g.edges.length - (n - 1));
      expect(res.steps.reduce((s, x) => s + x.newCount, 0)).toBe(n - 1);
    }
  });

  it('latihanGraph juga lengkap dan emptyLsdb kosong', () => {
    expect(lsdbHas(runFlooding(latihanGraph, { origins: ['A'] }).lsdb, ['A'])).toBe(true);
    expect(Object.values(emptyLsdb(latihanGraph)).every((r) => Object.keys(r).length === 0)).toBe(true);
  });
});
