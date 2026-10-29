import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { ChecksumLab, CrcLab, DetectLab, Parity2D, ParityLab } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="Deteksi Kesalahan" subtitle="Bagaimana penerima tahu bahwa bit berubah di jalan: parity, CRC, dan checksum Internet.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame title="Parity: satu bit pengaman" notes="Balik satu bit: terdeteksi. Balik dua bit: lolos. Tanyakan mengapa, lalu hubungkan dengan 'jumlah bit 1 harus genap'.">
        <ParityLab />
      </SlideFrame>

      <SlideFrame title="Parity dua dimensi" notes="Klik satu bit: lokasi muncul dan bisa dikoreksi. Lalu coba pola 4 bit di sudut persegi: lolos. Mengapa?">
        <Parity2D />
      </SlideFrame>

      <SlideFrame title="CRC: pembagian tanpa pinjaman" notes="Contoh kuliah: D = 101110, G = 1001, R = 011. Jalankan pembagian langkah demi langkah, lalu rusak satu bit di frame untuk melihat sisa tidak nol.">
        <CrcLab />
      </SlideFrame>

      <SlideFrame title="Checksum Internet" notes="Perhatikan carry yang dibawa kembali (wraparound). Pada contoh header IPv4 hasilnya B861. Penerima menjumlahkan semuanya dan mengharapkan FFFF.">
        <ChecksumLab />
      </SlideFrame>

      <SlideFrame title="Siapa mendeteksi apa?" notes="Pilih tiap pola. Pola 'saling meniadakan' adalah titik buta checksum; 'sudut persegi' titik buta parity 2D. CRC-8 mendeteksi keduanya.">
        <DetectLab />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="Soal 4 menghubungkan teknik dengan pemakaiannya di jaringan.">
        <Quiz
          items={[
            {
              q: 'Parity tunggal gagal mendeteksi kerusakan bila...',
              options: ['Jumlah bit yang berubah ganjil', 'Jumlah bit yang berubah genap', 'Bit parity ikut hilang', 'Datanya lebih dari 8 bit'],
              answer: 1,
              why: 'Dua bit yang berubah mengembalikan paritas ke genap, sehingga penerima mengira data benar.',
            },
            {
              q: 'Apa kelebihan parity dua dimensi dibanding parity tunggal?',
              options: ['Tidak butuh bit tambahan', 'Bisa menemukan dan mengoreksi satu bit yang salah', 'Mendeteksi semua error, berapa pun jumlahnya', 'Lebih cepat dihitung daripada CRC'],
              answer: 1,
              why: 'Baris dan kolom yang paritasnya salah berpotongan di bit yang rusak, sehingga posisinya diketahui dan bisa dibalik.',
            },
            {
              q: 'Pada CRC, frame yang diterima dianggap benar bila...',
              options: ['Sisa pembagian oleh generator sama dengan nol', 'Jumlah bit 1 genap', 'Semua bit bernilai 1', 'Panjang frame kelipatan 16'],
              answer: 0,
              why: 'Pengirim memilih sisa $R$ sehingga $D\\cdot 2^r \\oplus R$ habis dibagi $G$. Frame rusak hampir selalu meninggalkan sisa tidak nol.',
            },
            {
              q: 'Mengapa Ethernet memakai CRC sedangkan UDP dan TCP memakai checksum Internet?',
              options: ['CRC tidak bisa dihitung perangkat lunak', 'CRC dikerjakan perangkat keras di kartu jaringan; checksum murah dihitung perangkat lunak', 'Checksum lebih kuat daripada CRC', 'Karena Ethernet tidak punya header'],
              answer: 1,
              why: 'CRC kuat tetapi butuh perangkat keras agar cepat, cocok di lapisan data link. Checksum Internet sederhana dihitung oleh perangkat lunak di lapisan atas.',
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
