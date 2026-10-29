import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { AimdPlay, BottleneckLab, CcSandbox, CcSim, Fairness, PhaseMap, RttTimer, TahoeReno } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="TCP Congestion Control" subtitle="Bagaimana TCP menebak seberapa cepat boleh mengirim: slow start, AIMD, dan mengapa semua aliran berbagi jaringan dengan adil.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame title="Dua masalah, dua mekanisme" notes="Naikkan kecepatan kirim di atas kemampuan penerima, lalu di atas kapasitas jaringan. Tanya: siapa yang kewalahan di tiap kasus, dan siapa yang bisa memberi tahu pengirim?">
        <BottleneckLab />
      </SlideFrame>

      <SlideFrame title="AIMD dan gigi gergaji" notes="Biarkan mahasiswa memencet 'Kirim 1 RTT' sampai cwnd besar, lalu '3 ACK ganda' atau 'Timeout'. Tunjukkan bentuk gigi gergaji yang terbentuk dari naik pelan dan turun cepat.">
        <AimdPlay />
      </SlideFrame>

      <SlideFrame title="Fase-fase TCP" notes="Klik tiap fase dan perhatikan bagian grafik yang menyala. Perhatikan beda reaksi 3 ACK ganda dan timeout.">
        <PhaseMap />
      </SlideFrame>

      <SlideFrame title="Simulator per RTT" notes="Nyalakan 'Mode tebak dulu': minta mahasiswa menebak cwnd RTT berikutnya. Ganti ke Tahoe untuk melihat bedanya setelah 3 ACK ganda.">
        <CcSim />
      </SlideFrame>

      <SlideFrame title="Tahoe lawan Reno" notes="Pada 3 ACK ganda Reno lebih unggul; pada timeout keduanya sama. Geser RTT terjadinya loss.">
        <TahoeReno />
      </SlideFrame>

      <SlideFrame title="Sandbox: atur kehilangan sendiri" notes="Minta mahasiswa memprediksi dampak menaikkan ssthresh awal, atau menaruh dua timeout berturut-turut.">
        <CcSandbox />
      </SlideFrame>

      <SlideFrame title="Mengapa AIMD adil?" notes="Mulai dengan satu aliran jauh lebih besar dari yang lain. Di AIMD lintasan merapat ke garis adil; di AIAD sejajar dengannya selamanya.">
        <Fairness />
      </SlideFrame>

      <SlideFrame title="Timer TCP: estimasi RTT" notes="Tambah lonjakan 300 ms: estimasi hanya naik sedikit, tetapi margin (Dev) melebar sehingga timeout melonjak.">
        <RttTimer />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="Soal 3 menjelaskan intuisi AIMD.">
        <Quiz
          items={[
            {
              q: 'Apa beda utama flow control dan congestion control?',
              options: ['Flow control melindungi penerima ($\\mathrm{rwnd}$); congestion control melindungi jaringan ($\\mathrm{cwnd}$)', 'Keduanya sama, hanya beda nama', 'Flow control dilakukan router; congestion control dilakukan penerima', 'Congestion control hanya dipakai UDP'],
              answer: 0,
              why: 'Penerima yang kewalahan memberi tahu lewat $\\mathrm{rwnd}$. Kemacetan jaringan tidak diumumkan siapa pun; pengirim menyimpulkannya dari kehilangan paket dan mengatur $\\mathrm{cwnd}$.',
            },
            {
              q: 'TCP Reno mendeteksi 3 ACK ganda saat $\\mathrm{cwnd}=20$. Berapa $\\mathrm{cwnd}$ sesudahnya?',
              options: ['$1$', '$10$', '$20$', '$40$'],
              answer: 1,
              why: 'Reno menetapkan $\\mathrm{ssthresh}=\\lfloor 20/2\\rfloor=10$ lalu $\\mathrm{cwnd}=10$ dan langsung congestion avoidance. Tahoe akan kembali ke $1$.',
            },
            {
              q: 'Mengapa AIMD membuat dua aliran berbagi link dengan adil?',
              options: ['Karena router membagi bandwidth sama rata', 'Penambahan sama rata tidak mengubah selisih, tetapi pembagian dua memperkecilnya tiap kali macet', 'Karena aliran yang lebih besar selalu menyerah', 'Karena timeout menyamakan semua aliran'],
              answer: 1,
              why: 'Pengurangan multiplikatif memotong yang besar lebih banyak dalam angka mutlak, sehingga selisih menyusut; penambahan aditif tidak mengubahnya.',
            },
            {
              q: 'Apa yang terjadi pada $\\mathrm{cwnd}$ dan $\\mathrm{ssthresh}$ saat timeout terjadi?',
              options: ['$\\mathrm{cwnd}$ dibagi dua, $\\mathrm{ssthresh}$ tetap', '$\\mathrm{ssthresh}=\\mathrm{cwnd}/2$ dan $\\mathrm{cwnd}$ kembali ke $1$ (slow start)', '$\\mathrm{cwnd}$ naik $1$', 'Keduanya tidak berubah'],
              answer: 1,
              why: 'Timeout dianggap tanda kemacetan parah: ambang diturunkan setengahnya dan pengirim memulai lagi dari $1$ MSS.',
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
