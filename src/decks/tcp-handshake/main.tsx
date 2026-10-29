import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { HandshakeLab, SeqLab, TeardownLab } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="TCP: Membuka dan Menutup Koneksi" subtitle="Three-way handshake, nomor urut dan ACK per byte, dan empat langkah menutup koneksi dengan rapi.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame title="Three-way handshake" notes="Tanya: mengapa tiga pesan, bukan dua? Jawab: agar kedua pihak tahu nomor urut awal dan kemampuan menerima pihak lain. Nyalakan 'Mode tebak dulu' untuk nomor ACK. Coba skenario SYN hilang dan SYN+ACK hilang.">
        <HandshakeLab />
      </SlideFrame>

      <SlideFrame title="Nomor urut dan ACK" notes="Nomor urut menghitung byte. Geser ukuran segmen, lalu hilangkan segmen ke-2: segmen ke-3 memicu ACK ganda.">
        <SeqLab />
      </SlideFrame>

      <SlideFrame title="Menutup koneksi" notes="Empat pesan karena tiap arah ditutup sendiri (half-close). Tanyakan: mengapa klien menunggu di TIME_WAIT? Agar ACK terakhir yang hilang bisa dijawab ulang.">
        <TeardownLab />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="Soal 2 menegaskan bahwa SYN dan FIN menghabiskan satu nomor urut.">
        <Quiz
          items={[
            {
              q: 'Klien mengirim SYN dengan $\\mathrm{seq}=1000$. Berapa $\\mathrm{ack}$ pada SYN+ACK dari server?',
              options: ['$1000$', '$1001$', '$1100$', '$5000$'],
              answer: 1,
              why: 'SYN menghabiskan satu nomor urut, jadi server menunggu byte bernomor $1001$.',
            },
            {
              q: 'Mengapa FIN memakai $\\mathrm{seq}=2001$ dijawab ACK berisi $2002$?',
              options: ['Karena FIN membawa data 1 byte yang sebenarnya', 'Karena FIN menghabiskan satu nomor urut', 'Karena ACK selalu ditambah satu', 'Karena nomor urut selalu naik per segmen'],
              answer: 1,
              why: 'Seperti SYN, FIN dihitung satu nomor urut supaya bisa di-ACK dengan jelas, walau tanpa byte data.',
            },
            {
              q: 'Segmen ke-2 dari tiga segmen hilang. Apa yang dilakukan penerima saat segmen ke-3 tiba?',
              options: ['Mengirim ACK baru untuk segmen ke-3', 'Mengirim ACK ganda untuk byte yang masih ditunggu', 'Menutup koneksi', 'Tidak mengirim apa pun'],
              answer: 1,
              why: 'ACK kumulatif hanya maju sampai byte berurutan terakhir, jadi segmen di luar urutan menghasilkan ACK ganda.',
            },
            {
              q: 'Mengapa sisi yang menutup lebih dulu menunggu di TIME_WAIT?',
              options: ['Agar port tidak terpakai selamanya', 'Agar ACK terakhir yang hilang masih bisa dijawab ulang dan sisa segmen lama lenyap', 'Karena server meminta begitu', 'Untuk menghemat memori'],
              answer: 1,
              why: 'Bila ACK terakhir hilang, server mengirim ulang FIN; klien yang masih di TIME_WAIT dapat menjawabnya. Waktu $2\\times\\mathrm{MSL}$ juga memastikan segmen lama sudah hilang dari jaringan.',
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
