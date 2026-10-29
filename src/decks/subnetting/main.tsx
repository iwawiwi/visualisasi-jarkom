import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { AndLab, BitLab, BlockFinder, PrefixLab, VlsmCompare, VlsmSandbox, VlsmSteps } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="Subnetting, CIDR & VLSM" subtitle="Membagi blok alamat IPv4 dengan tepat: dari bit, prefiks, sampai pembagian subnet sesuai kebutuhan.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame
        title="Alamat IP itu hanya bit"
        notes="Minta mahasiswa membalik bit di oktet terakhir dan menebak angkanya sebelum melihat jumlahnya. Tekankan: satu oktet 8 bit, nilainya 0–255."
      >
        <BitLab />
      </SlideFrame>

      <SlideFrame
        title="Bagian network dan bagian host"
        notes="Geser prefiks perlahan dari /24 ke /26 ke /30. Tanyakan: apa yang terjadi pada jumlah subnet dan jumlah host? Tombol kelas lama menunjukkan mengapa classful boros."
      >
        <PrefixLab />
      </SlideFrame>

      <SlideFrame
        title="IP AND mask = alamat network"
        notes="Panah/spasi mengungkap hasil AND oktet demi oktet. Ganti contoh ke /27 dan /20: di /20 oktet ketiga berubah sebagian."
      >
        <AndLab />
      </SlideFrame>

      <SlideFrame
        title="Di blok mana alamat ini?"
        notes="Nyalakan 'Mode tebak dulu', gerakkan slider, lalu minta mahasiswa menunjuk blok. Cara cepat: bagi oktet terakhir dengan ukuran blok, buang sisanya, kalikan lagi."
      >
        <BlockFinder />
      </SlideFrame>

      <SlideFrame
        title="Mengapa perlu VLSM?"
        notes="Bandingkan FLSM dan VLSM pada kebutuhan 100/50/2 host. Dengan FLSM semua subnet harus /25, dan tiga blok /25 tidak muat di satu /24."
      >
        <VlsmCompare />
      </SlideFrame>

      <SlideFrame
        title="VLSM langkah demi langkah"
        notes="Nyalakan 'Mode tebak dulu': minta mahasiswa menyebut prefiks tiap subnet sebelum dibuka. Aturan emas: urutkan dari yang terbesar, beri blok terkecil yang cukup."
      >
        <VlsmSteps />
      </SlideFrame>

      <SlideFrame
        title="Sandbox: rancang subnetmu"
        notes="Biarkan mahasiswa mengubah angka host dan blok induk. Minta mereka mencari batas kebutuhan sampai satu subnet 'tidak muat'."
      >
        <VlsmSandbox />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="Soal 4 menegaskan alasan mengurutkan dari yang terbesar.">
        <Quiz
          items={[
            {
              q: 'Alamat $192.168.1.70/27$ berada di blok mana?',
              options: ['$192.168.1.32$ – $192.168.1.63$', '$192.168.1.64$ – $192.168.1.95$', '$192.168.1.64$ – $192.168.1.127$', '$192.168.1.0$ – $192.168.1.31$'],
              answer: 1,
              why: 'Ukuran blok $/27$ adalah $32$. $\\lfloor 70/32\\rfloor\\times 32=64$, jadi blok dimulai di $64$ dan berakhir di $95$.',
            },
            {
              q: 'Berapa host yang bisa dipakai pada subnet $/26$?',
              options: ['$64$', '$62$', '$60$', '$30$'],
              answer: 1,
              why: 'Bit host $=32-26=6$, jadi $2^6=64$ alamat. Dikurangi alamat network dan broadcast: $64-2=62$.',
            },
            {
              q: 'Mengapa VLSM lebih hemat daripada FLSM?',
              options: ['Karena VLSM memakai mask yang lebih pendek', 'Karena tiap subnet diberi blok sesuai kebutuhannya masing-masing', 'Karena VLSM tidak memakai alamat broadcast', 'Karena VLSM hanya dipakai untuk IPv6'],
              answer: 1,
              why: 'FLSM mematok semua subnet pada ukuran kebutuhan terbesar, sehingga jaringan kecil ikut mendapat blok besar. VLSM menyesuaikan ukuran per subnet.',
            },
            {
              q: 'Pada VLSM, mengapa kebutuhan diurutkan dari yang terbesar lebih dulu?',
              options: ['Agar nama subnet urut abjad', 'Agar blok besar yang harus sejajar kelipatan ukurannya ditempatkan dulu, tanpa celah', 'Agar mask selalu $/24$', 'Agar alamat broadcast tidak diperlukan'],
              answer: 1,
              why: 'Blok besar hanya boleh dimulai pada kelipatan ukurannya. Menempatkannya lebih dulu mencegah celah, dan ruang kecil yang tersisa di akhir tetap berguna.',
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
