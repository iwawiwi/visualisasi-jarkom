import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { RdtSim } from './RdtSim';
import { ChannelProblems, GbnVsSr, ToolBox, UtilCalc } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="Reliable Data Transfer" subtitle="Bagaimana data tiba lengkap dan berurutan lewat jaringan yang boleh kehilangan paket: Stop-and-Wait, Go-Back-N, dan Selective Repeat.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame title="Kanal yang tidak bisa dipercaya" notes="Pilih tiap gangguan dan tanyakan: apa yang dilihat pengirim? Pada paket hilang dan ACK hilang, pengirim sama-sama tidak menerima ACK: ia tidak bisa membedakan keduanya.">
        <ChannelProblems />
      </SlideFrame>

      <SlideFrame title="Kotak perkakas keandalan" notes="Setiap perkakas menjawab satu masalah. Minta mahasiswa menebak perkakas apa yang menangani 'duplikat' sebelum membuka kartunya.">
        <ToolBox />
      </SlideFrame>

      <SlideFrame
        title="Stop-and-Wait (rdt3.0)"
        notes="Jalankan keempat skenario. Nyalakan 'Mode tebak dulu': minta mahasiswa menebak aksi pengirim berikutnya. Perhatikan pada skenario ACK hilang: penerima membuang duplikat namun tetap mengirim ACK."
      >
        <RdtSim mode="lesson" protocol="saw" />
      </SlideFrame>

      <SlideFrame title="Mengapa Stop-and-Wait lambat?" notes="Mulai dari 1 Gbps, RTT 30 ms: utilisasi hanya sekitar 0,027%. Geser jumlah paket di jalan sampai link terisi penuh; itulah alasan pipelining.">
        <UtilCalc />
      </SlideFrame>

      <SlideFrame
        title="Go-Back-N"
        notes="Pilih 'Paket 2 hilang'. Tanya: mengapa penerima membuang paket 3, 4, 5 padahal sudah sampai? Pada 'ACK 1 hilang', tunjukkan ACK kumulatif menutupi kehilangan."
      >
        <RdtSim mode="lesson" protocol="gbn" />
      </SlideFrame>

      <SlideFrame title="Selective Repeat" notes="Bandingkan dengan skenario 'Paket 2 hilang' di Go-Back-N: di sini paket 3, 4, 5 ditahan di buffer dan hanya paket 2 yang dikirim ulang.">
        <RdtSim mode="lesson" protocol="sr" />
      </SlideFrame>

      <SlideFrame title="Go-Back-N lawan Selective Repeat" notes="Geser paket yang hilang dan jumlahnya. Semakin banyak kehilangan, semakin besar penghematan SR, tetapi buffer penerimanya lebih besar.">
        <GbnVsSr />
      </SlideFrame>

      <SlideFrame title="Sandbox: atur sendiri" notes="Minta mahasiswa merancang pola kehilangan yang membuat GBN jauh lebih lambat daripada SR, lalu mencari pola yang membuat keduanya sama.">
        <RdtSim mode="sandbox" />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="Soal 2 memeriksa pemahaman perbedaan GBN dan SR.">
        <Quiz
          items={[
            {
              q: 'Mengapa Stop-and-Wait memakai link cepat dengan sangat boros?',
              options: ['Karena paketnya selalu kecil', 'Karena pengirim menganggur menunggu ACK sepanjang waktu pulang-pergi', 'Karena ACK memakai banyak bandwidth', 'Karena checksum lambat dihitung'],
              answer: 1,
              why: 'Utilisasi $U=\\dfrac{L/R}{\\mathrm{RTT}+L/R}$. Pada link cepat $L/R$ sangat kecil dibandingkan RTT, sehingga hampir seluruh waktu dipakai menunggu.',
            },
            {
              q: 'Pada Go-Back-N, paket $2$ hilang sedangkan paket $3$, $4$, $5$ sudah dikirim. Apa yang dikirim ulang setelah timeout?',
              options: ['Hanya paket $2$', 'Paket $2$ dan semua paket sesudahnya', 'Semua paket dari $0$', 'Hanya paket $5$'],
              answer: 1,
              why: 'Penerima GBN membuang paket di luar urutan, jadi pengirim harus mengulang dari paket yang hilang sampai paket terakhir yang sudah dikirim.',
            },
            {
              q: 'Apa kelebihan Selective Repeat dibanding Go-Back-N, dan harga yang dibayar?',
              options: ['Tanpa timer, tetapi butuh checksum', 'Hanya mengulang paket yang hilang, tetapi penerima butuh buffer dan ACK per paket', 'Tanpa nomor urut, tetapi butuh jendela lebih besar', 'Lebih cepat selalu, tanpa harga apa pun'],
              answer: 1,
              why: 'SR menghemat pengiriman ulang karena paket di luar urutan ditahan di buffer penerima, dengan imbalan logika dan memori yang lebih rumit.',
            },
            {
              q: 'Mengapa nomor urut diperlukan walaupun sudah ada kirim ulang?',
              options: ['Agar paket dikirim lebih cepat', 'Agar penerima membedakan paket baru dari duplikat hasil kirim ulang', 'Agar checksum tidak diperlukan', 'Agar ACK tidak pernah hilang'],
              answer: 1,
              why: 'Kirim ulang menimbulkan duplikat (misalnya saat ACK hilang). Tanpa nomor urut, penerima akan menyerahkan data yang sama dua kali ke aplikasi.',
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
