import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckShell } from '../../core/DeckShell';
import { SlideFrame, TitleSlide } from '../../core/components/SlideFrame';
import { Quiz } from '../../core/components/Quiz';
import { DoraSim, LeaseLab, PoolSandbox } from './slides';

function Deck() {
  return (
    <DeckShell>
      <TitleSlide title="DHCP: Dapat Alamat IP Otomatis" subtitle="Bagaimana perangkat yang baru tersambung mendapat alamat IP, mask, gateway, dan DNS tanpa konfigurasi manual.">
        Tekan <code>→</code> untuk lanjut · <code>S</code> catatan pembicara · <code>Esc</code> ringkasan semua slide
      </TitleSlide>

      <SlideFrame title="DORA: Discover, Offer, Request, Acknowledge" notes="Nyalakan 'Mode tebak dulu'. Tanyakan: mengapa DISCOVER dikirim dari 0.0.0.0 ke 255.255.255.255? Klien belum punya IP dan belum tahu siapa servernya. Coba skenario dua server dan tanpa server.">
        <DoraSim />
      </SlideFrame>

      <SlideFrame title="Sewa alamat" notes="Geser waktu berjalan. Pada T1 klien memperbarui ke server asal (unicast), pada T2 ke server mana pun (broadcast).">
        <LeaseLab />
      </SlideFrame>

      <SlideFrame title="Sandbox: pool alamat" notes="Perkecil pool, tambahkan klien sampai habis, dan perhatikan klien yang jatuh ke APIPA. Lepas satu klien: alamatnya dipakai lagi oleh klien berikutnya.">
        <PoolSandbox />
      </SlideFrame>

      <SlideFrame title="Kuis singkat" notes="OFFER dan ACK di sini digambarkan broadcast (bendera BROADCAST dipasang klien); bila tidak, server mengirim unicast ke alamat yang ditawarkan. Soal 4 mengaitkan DHCP dengan kegagalan di jaringan nyata.">
        <Quiz
          items={[
            {
              q: 'Mengapa DHCPDISCOVER dikirim secara broadcast dari $0.0.0.0$?',
              options: ['Karena klien belum punya alamat IP dan belum tahu alamat server', 'Karena server hanya menerima broadcast', 'Untuk menghemat bandwidth', 'Karena UDP tidak punya alamat tujuan'],
              answer: 0,
              why: 'Klien yang baru menyala belum punya IP dan belum tahu siapa servernya, jadi ia menyiarkan ke seluruh segmen dengan sumber $0.0.0.0$.',
            },
            {
              q: 'Dua server DHCP menawarkan alamat. Mengapa DHCPREQUEST tetap disiarkan?',
              options: ['Karena unicast tidak didukung', 'Agar router meneruskannya', 'Agar server yang tidak dipilih tahu tawarannya ditolak dan mengembalikan alamat ke poolnya', 'Agar klien mendapat dua alamat'],
              answer: 2,
              why: 'Siaran ini memberi tahu semua server siapa yang dipilih (server identifier), sehingga yang lain menarik tawarannya.',
            },
            {
              q: 'Sewa $8$ jam. Kapan klien mulai memperbarui ke server asalnya?',
              options: ['Setelah $7$ jam ($T_2=87{,}5\\%$)', 'Setelah $4$ jam ($T_1=50\\%$)', 'Setelah $8$ jam', 'Tidak pernah'],
              answer: 1,
              why: 'Pada $T_1=50\\%$ klien mengirim DHCPREQUEST unicast ke server asal. Pada $T_2=87{,}5\\%$ ia menyiarkan ke server mana pun.',
            },
            {
              q: 'Laptop di kafe memakai alamat $169.254.x.y$ dan tidak bisa membuka internet. Apa artinya?',
              options: ['Internet sedang lambat', 'Laptop memakai IPv6', 'DNS salah', 'Server DHCP tidak menjawab; laptop memberi dirinya alamat APIPA tanpa gateway'],
              answer: 3,
              why: 'Alamat $169.254.0.0/16$ adalah APIPA: pilihan klien sendiri ketika DHCP gagal. Tanpa gateway, hanya host di segmen yang sama yang terjangkau.',
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
