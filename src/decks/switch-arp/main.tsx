import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { ArpLab, RouterHops, SwitchLab } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="Switch, ARP, dan Pengiriman Antar Subnet" subtitle="Bagaimana frame menemukan tujuannya: switch yang belajar sendiri, ARP yang menerjemahkan IP menjadi MAC, dan router yang mengganti alamat di tiap hop.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame title="Switch yang belajar sendiri" notes="Nyalakan 'Mode tebak dulu'. Tiga aksi: flood (tujuan belum dikenal atau broadcast), forward (tujuan di port lain), filter (tujuan di port yang sama dengan pengirim). Perhatikan frame E → A: A dan E berbagi port lewat hub.">
        <SwitchLab mode="lesson" />
      </SlideFrame>

      <SlideFrame title="Sandbox: kirim frame sendiri" notes="Minta mahasiswa memprediksi jumlah flood sebelum tabel penuh. Coba broadcast: selalu di-flood.">
        <SwitchLab mode="sandbox" />
      </SlideFrame>

      <SlideFrame title="ARP: dari IP ke MAC" notes="Jalankan dengan tabel kosong, lalu ulangi dengan 'tabel ARP sudah berisi'. C menerima siaran tetapi mengabaikannya. Hanya B yang membalas, secara unicast.">
        <ArpLab />
      </SlideFrame>

      <SlideFrame title="Antar subnet: IP tetap, MAC berganti" notes="Kunci: alamat IP menunjukkan tujuan akhir, alamat MAC hanya berlaku untuk satu segmen. Nyalakan mode tebak untuk MAC tujuan frame kedua.">
        <RouterHops />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="Soal 4 merangkum perbedaan IP dan MAC.">
        <Quiz
          items={[
            {
              q: 'Switch menerima frame dengan tujuan yang belum ada di tabelnya. Apa yang dilakukan?',
              options: ['Membuang frame', 'Flood: menyalin ke semua port selain port masuk', 'Mengirim kembali ke pengirim', 'Menunggu sampai tujuan mengirim sesuatu'],
              answer: 1,
              why: 'Tujuan yang belum dikenal membuat switch menyiarkan frame ke semua port lain. Saat tujuan membalas, switch belajar port-nya.',
            },
            {
              q: 'Dari mana switch mengetahui di port mana sebuah host berada?',
              options: ['Dari alamat sumber frame yang masuk', 'Dari alamat tujuan frame', 'Dari konfigurasi manual wajib', 'Dari tabel ARP router'],
              answer: 0,
              why: 'Setiap frame yang masuk membawa MAC sumber; switch mencatatnya bersama port masuk (self-learning).',
            },
            {
              q: 'Mengapa permintaan ARP berupa siaran (broadcast)?',
              options: ['Karena ARP tidak punya alamat', 'Karena pengirim belum tahu MAC target, jadi menanyakan ke semua host di subnet', 'Karena router hanya mengerti broadcast', 'Karena IP tujuan tidak valid'],
              answer: 1,
              why: 'Pengirim hanya tahu IP target. Siaran menjangkau semua host; hanya pemilik IP itu yang membalas.',
            },
            {
              q: 'Saat frame melewati router, apa yang berubah?',
              options: ['IP sumber dan IP tujuan', 'MAC sumber dan MAC tujuan (serta TTL berkurang)', 'Tidak ada yang berubah', 'Hanya IP tujuan'],
              answer: 1,
              why: 'IP menunjukkan tujuan akhir sehingga tetap; MAC hanya berlaku per segmen, jadi diganti tiap hop. TTL dikurangi satu oleh router.',
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
