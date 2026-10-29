import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { AdLab, AddressLine, LpmLab, RouteSandbox } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="Longest Prefix Match" subtitle="Bagaimana router memilih satu rute dari banyak yang cocok: prefiks terpanjang, lalu Administrative Distance, lalu metrik.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame title="Cocokkan bit demi bit" notes="Contoh kuliah: 192.168.1.150 cocok dengan /0, /16, /24, dan /25. Klik tiap baris untuk melihat bit mana yang dibandingkan. Prefiks /27 tidak cocok: bit ke-26 berbeda.">
        <LpmLab />
      </SlideFrame>

      <SlideFrame title="Rute yang bertumpuk" notes="Nyalakan 'Mode tebak dulu': minta mahasiswa menunjuk rute pemenang. Geser alamat ke 200 dan ke 100. Rute yang lebih spesifik selalu menang.">
        <AddressLine />
      </SlideFrame>

      <SlideFrame title="Prefiks sama, sumber beda" notes="Matikan dan nyalakan rute. Urutannya: prefiks dulu, baru AD, baru metrik. Rute /24 dari RIP mengalahkan /16 statis.">
        <AdLab />
      </SlideFrame>

      <SlideFrame title="Sandbox: tabel routing sendiri" notes="Minta mahasiswa merancang tabel yang menyalurkan satu alamat ke next hop tertentu, termasuk menghapus rute default.">
        <RouteSandbox />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="Soal 3 mengingatkan bahwa AD hanya berlaku untuk prefiks yang sama.">
        <Quiz
          items={[
            {
              q: 'Tujuan $192.168.1.150$ cocok dengan $0.0.0.0/0$, $192.168.0.0/16$, dan $192.168.1.128/25$. Mana yang dipilih?',
              options: ['$0.0.0.0/0$', '$192.168.0.0/16$', '$192.168.1.128/25$', 'Yang pertama di tabel'],
              answer: 2,
              why: 'Router memilih prefiks terpanjang: $/25$ paling spesifik, mencocokkan $25$ bit pertama.',
            },
            {
              q: 'Apa fungsi rute default $0.0.0.0/0$?',
              options: ['Mencocokkan semua alamat, tetapi kalah dari rute yang lebih spesifik', 'Menolak semua paket', 'Hanya untuk alamat private', 'Menggantikan semua rute lain'],
              answer: 0,
              why: 'Panjang prefiksnya $0$, jadi cocok dengan semua alamat namun selalu kalah oleh rute yang lebih panjang; dipakai sebagai jalan terakhir.',
            },
            {
              q: 'Ada rute $10.20.0.0/16$ statis ($\\mathrm{AD}=1$) dan rute $10.20.5.0/24$ dari RIP ($\\mathrm{AD}=120$). Tujuan $10.20.5.9$ lewat mana?',
              options: ['Rute statis karena AD lebih kecil', 'Rute RIP karena prefiksnya lebih panjang', 'Dibagi dua', 'Dibuang'],
              answer: 1,
              why: 'Prefiks dibandingkan lebih dulu. AD baru dipakai bila prefiksnya sama persis.',
            },
            {
              q: 'Untuk prefiks yang sama dari OSPF ($110$) dan RIP ($120$), router memakai...',
              options: ['RIP', 'OSPF', 'Keduanya bergantian', 'Metrik terkecil, apa pun protokolnya'],
              answer: 1,
              why: 'AD terkecil lebih dipercaya. Metrik hanya membandingkan rute dari protokol yang sama.',
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
