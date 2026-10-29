import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { FloodSim } from './FloodSim';
import { DrBdr, LsaCard, OspfCost, SeqCompare } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="Link-State Flooding & OSPF" subtitle="Bagaimana setiap router mendapat peta jaringan yang sama — dan apa yang terjadi saat sebuah link berubah.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame
        title="Satu router, satu LSA"
        notes="Dijkstra butuh peta lengkap, tetapi tiap router hanya mengenal tetangganya. Klik beberapa router dan tunjukkan bahwa LSA hanya berisi link miliknya sendiri. Tanyakan: bagaimana router lain bisa mengetahuinya?"
      >
        <LsaCard />
      </SlideFrame>

      <SlideFrame
        title="Flooding langkah demi langkah"
        notes="Nyalakan 'Mode tebak dulu': minta mahasiswa menebak berapa router yang menerima LSA baru di ronde berikutnya. Perhatikan garis merah: pesan yang dibuang karena duplikat. Total pesan selalu 2m − (n − 1) untuk satu LSA pada graf terhubung (m link, n router)."
      >
        <FloodSim mode="lesson" />
      </SlideFrame>

      <SlideFrame
        title="Mengapa perlu nomor urut?"
        notes="Geser ronde ke kanan. Tanpa nomor urut, router tidak tahu bahwa kabar itu sudah pernah ia terima, sehingga pesan berputar di loop. Nomor urut juga yang membuat kabar lama tidak menimpa kabar baru."
      >
        <SeqCompare />
      </SlideFrame>

      <SlideFrame
        title="Semua router punya peta yang sama"
        notes="Sekarang semua router menyiarkan LSA-nya. Akhirnya tiap baris tabel identik: itulah LSDB. Dari sini setiap router menjalankan Dijkstra sendiri-sendiri (deck sebelumnya)."
      >
        <FloodSim mode="all" />
      </SlideFrame>

      <SlideFrame
        title="Sandbox: link berubah"
        notes="Minta mahasiswa memprediksi: jika link x–y diputus, router mana yang menyiarkan LSA baru? (hanya dua ujung link). Lalu buktikan. Perhatikan nomor urut naik menjadi 2."
      >
        <FloodSim mode="change" />
      </SlideFrame>

      <SlideFrame
        title="Biaya link di OSPF"
        notes="Dengan bandwidth referensi 100 Mbps, FastEthernet dan Gigabit sama-sama berbiaya 1, sehingga dua link Gigabit dianggap lebih mahal daripada satu FastEthernet. Naikkan bandwidth referensi untuk memperbaikinya."
      >
        <OspfCost />
      </SlideFrame>

      <SlideFrame
        title="Segmen ramai: DR dan BDR"
        notes="Tanpa DR/BDR jumlah adjacency tumbuh kuadrat. Geser jumlah router, lalu nyalakan DR/BDR. Pada 5 router: 10 lawan 7."
      >
        <DrBdr />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="Soal 3 menjembatani kembali ke Dijkstra.">
        <Quiz
          items={[
            {
              q: 'Apa isi sebuah LSA?',
              options: ['Seluruh peta jaringan', 'Daftar tetangga langsung beserta biaya link-nya', 'Tabel forwarding router', 'Hanya alamat IP router'],
              answer: 1,
              why: 'LSA hanya merangkum link milik satu router. Peta lengkap baru terbentuk setelah LSA semua router terkumpul.',
            },
            {
              q: 'Untuk apa nomor urut pada LSA?',
              options: ['Agar LSA dikirim berurutan alfabet', 'Agar router membuang duplikat dan menolak kabar lama', 'Agar LSA dienkripsi', 'Agar biaya link naik tiap ronde'],
              answer: 1,
              why: 'Router hanya meneruskan LSA dengan nomor urut lebih besar dari yang ia simpan, sehingga flooding berhenti dan kabar basi tidak menimpa yang baru.',
            },
            {
              q: 'Setelah flooding selesai, apa yang dimiliki dan dilakukan tiap router?',
              options: ['LSDB berbeda-beda; ia menebak sisanya', 'LSDB yang sama; ia menjalankan Dijkstra sendiri', 'Hanya tabel tetangga; ia bertanya ke router lain tiap paket', 'Tidak ada; routing dilakukan oleh satu router pusat'],
              answer: 1,
              why: 'Semua router memegang LSDB identik, lalu masing-masing menghitung jalur termurah dengan Dijkstra, dan hasilnya konsisten.',
            },
            {
              q: 'Bandwidth referensi OSPF tetap 100 Mbps. Apa akibatnya pada link FastEthernet dan Gigabit?',
              options: ['Biayanya sama (1), sehingga OSPF tidak bisa membedakannya', 'Gigabit selalu dipilih', 'Link FastEthernet diabaikan', 'OSPF berhenti bekerja'],
              answer: 0,
              why: 'Biaya $=\\max(1,\\lfloor \\text{referensi} / \\text{bandwidth} \\rfloor)$. Pada 100 Mbps keduanya berbiaya $1$. Naikkan bandwidth referensi agar Gigabit tampak lebih murah.',
            },
          ]}
        />
      </SlideFrame>
    </DeckShell>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Deck />
  </StrictMode>,
);
