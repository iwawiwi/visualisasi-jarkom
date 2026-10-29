# Jarkom Visual

Kumpulan slide interaktif **reveal.js + React** untuk memvisualisasikan algoritma Jaringan Komputer, ditujukan bagi mahasiswa yang masih awam.

| Deck | Isi |
|------|-----|
| `dijkstra.html` | Dijkstra (Link-State): coba rute sendiri, kamus notasi, intuisi "air mengalir", pseudocode, simulasi langkah demi langkah + mode tebak, pohon jalur & forwarding table, sandbox, kuis |
| `distance-vector.html` | Distance Vector: rumus Bellman-Ford, kalkulator, simulator grid 3×3 (rincian perhitungan per node), kabar baik vs kabar buruk (count-to-infinity, poisoned reverse), kuis |
| `lsa-flooding.html` | Link-State Flooding & OSPF: LSA per router, flooding per ronde + mode tebak, nomor urut vs tanpa nomor urut, sandbox link berubah, biaya OSPF, DR/BDR, kuis |
| `subnetting.html` | Subnetting, CIDR & VLSM: bit ↔ desimal, prefiks, IP AND mask, cari blok + mode tebak, FLSM vs VLSM, VLSM langkah demi langkah, sandbox, kuis |
| `rdt.html` | Reliable Data Transfer: kanal tak andal, perkakas keandalan, Stop-and-Wait, utilisasi, Go-Back-N, Selective Repeat, perbandingan, sandbox kehilangan, kuis |
| `tcp-cc.html` | TCP Congestion Control: flow vs congestion control, AIMD interaktif, fase TCP, simulator per RTT + mode tebak, Tahoe vs Reno, sandbox, keadilan AIMD/AIAD, timer RTT, kuis |
| `error-detection.html` | Deteksi Kesalahan: parity 1D dan 2D yang bisa dirusak, CRC langkah demi langkah, checksum Internet, perbandingan siapa mendeteksi apa, kuis |
| `csma-cd.html` | CSMA/CD dan Backoff: kelas protokol MAC, efisiensi slotted ALOHA, diagram ruang-waktu tabrakan dan frame minimum, backoff eksponensial + mode tebak, kuis |
| `switch-arp.html` | Switch, ARP & Antar Subnet: switch self-learning (flood/forward/filter) + mode tebak, sandbox kirim frame, ARP langkah demi langkah, IP tetap dan MAC berganti di tiap hop, kuis |
| `lpm.html` | Longest Prefix Match: perbandingan bit demi bit, rute bertumpuk pada garis alamat + mode tebak, Administrative Distance dan metrik, sandbox tabel routing, kuis |
| `tcp-handshake.html` | TCP: Handshake & Penutupan: three-way handshake (termasuk SYN dan SYN+ACK hilang) + tebak nomor ACK, nomor urut per byte dan ACK ganda, empat langkah menutup koneksi, kuis |
| `dhcp.html` | DHCP: DORA (satu server, dua server, tanpa server → APIPA) + tebak pesan berikutnya, timer sewa T1 dan T2, sandbox pool alamat, kuis |
| `index.html` | Katalog semua deck |

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit test algoritma (angka Kurose & Ross)
npm run build      # typecheck + build ke dist/ (siap diunggah ke GitHub Pages; deploy otomatis lewat GitHub Actions)
```

Navigasi: panah / spasi (di simulasi, panah menjalankan langkah lebih dulu) · `S` catatan pembicara · `Esc` ringkasan semua slide · `F` layar penuh. Tombol bulan/matahari di kanan atas mengganti tema.

## Tema

Catppuccin **Latte** (terang) dan **Mocha** (gelap), font **Google Sans Flex** dan **Google Sans Code**. Semua warna berasal dari variabel `--ctp-*` di `src/core/theme.css`.

## Struktur

* `src/algorithms/` — logika murni + test (tanpa React). Menghasilkan *trace* langkah yang diputar oleh UI.
* `src/core/` — komponen lintas deck: `GraphView` (graf SVG), `StepControls`, `Quiz`, `SlideFrame`, `PseudoCode`, `Tex`/`Rich` (KaTeX), `TimeChart`, `SeqDiagram`, `WindowStrip`, `BitRow`, `GuessCard`, `DeckShell`, hook `useFragmentStepper`, dan tema. Semua CSS dimuat lewat `src/core/styles.css`.
* `src/decks/<nama>/` — slide tiap deck. `src/decks/registry.ts` mendaftarkan deck untuk katalog.

Menambah deck baru: lihat `docs/PLAN.md` bagian 6.
