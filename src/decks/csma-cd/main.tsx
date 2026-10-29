import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { AlohaLab, BackoffSim, MacClasses, SpaceTimeLab } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="CSMA/CD dan Backoff Eksponensial" subtitle="Bagaimana banyak stasiun berbagi satu kabel Ethernet tanpa saling menimpa: dari ALOHA sampai menunggu secara acak.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame title="Tiga cara berbagi kanal" notes="Tanyakan: mana yang cocok untuk beban ringan, mana untuk beban berat? Ethernet memilih akses acak.">
        <MacClasses />
      </SlideFrame>

      <SlideFrame title="Slotted ALOHA" notes="Geser p ke kiri dan kanan dari puncak. Efisiensi puncaknya hanya sekitar 37%: separuh lebih slot terbuang entah kosong atau tabrakan.">
        <AlohaLab />
      </SlideFrame>

      <SlideFrame title="Mendengar dulu, tetap bisa tabrakan" notes="Geser waktu B mulai. Selama sinyal A belum sampai, B mengira kanal sepi. Ini sebab CSMA saja belum cukup.">
        <SpaceTimeLab withFrame={false} />
      </SlideFrame>

      <SlideFrame title="CSMA/CD: mendeteksi tabrakan" notes="Pendekkan frame sampai kurang dari 2d: A selesai mengirim sebelum tahu ada tabrakan. Itulah alasan ukuran frame Ethernet minimum.">
        <SpaceTimeLab withFrame />
      </SlideFrame>

      <SlideFrame title="Backoff eksponensial" notes="Nyalakan 'Mode tebak dulu'. Setelah tabrakan ke-n, jumlah pilihan K berlipat ganda. Coba 4 stasiun dan ganti acak berkali-kali.">
        <BackoffSim />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="Soal 3 menghubungkan frame minimum dengan jarak kabel.">
        <Quiz
          items={[
            {
              q: 'Berapa efisiensi maksimum slotted ALOHA untuk $N$ besar?',
              options: ['$100\\%$', '$\\approx 37\\%$', '$\\approx 50\\%$', '$\\approx 10\\%$'],
              answer: 1,
              why: 'Efisiensi $Np(1-p)^{N-1}$ maksimum di $p=1/N$ dan menuju $1/e\\approx 37\\%$.',
            },
            {
              q: 'Mengapa CSMA masih bisa mengalami tabrakan?',
              options: ['Karena stasiun tidak mau mendengar', 'Karena sinyal butuh waktu rambat, sehingga stasiun lain belum mendengarnya', 'Karena kabel memiliki banyak bit', 'Karena slot waktu terlalu panjang'],
              answer: 1,
              why: 'Stasiun yang mulai mengirim hampir bersamaan belum menerima sinyal satu sama lain, jadi keduanya melihat kanal sepi.',
            },
            {
              q: 'Mengapa frame Ethernet punya ukuran minimum?',
              options: ['Agar header tidak terlalu besar', 'Agar pengirim masih mengirim saat sinyal tabrakan tiba, sehingga tabrakan terdeteksi', 'Agar CRC selalu valid', 'Agar switch tidak bingung'],
              answer: 1,
              why: 'Tabrakan terburuk baru diketahui pengirim setelah $\\approx 2d$. Frame yang lebih pendek selesai dikirim dan tabrakannya tidak terlihat.',
            },
            {
              q: 'Setelah tabrakan ke-$3$, dari himpunan mana $K$ dipilih?',
              options: ['$\\{0,1\\}$', '$\\{0,1,2,3\\}$', '$\\{0,\\ldots,7\\}$', '$\\{0,\\ldots,15\\}$'],
              answer: 2,
              why: 'Rentangnya $\\{0,\\ldots,2^n-1\\}$; untuk $n=3$ berarti $\\{0,\\ldots,7\\}$ dan menunggu $K\\times 512$ bit-time.',
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
