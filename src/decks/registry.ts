export interface DeckInfo {
  id: string;
  href: string;
  title: string;
  topic: string;
  description: string;
  highlights: string[];
  status: 'ready' | 'soon';
}

export const decks: DeckInfo[] = [
  {
    id: 'dijkstra',
    href: './dijkstra.html',
    title: "Dijkstra's Link-State Routing",
    topic: 'Network Layer · Control Plane',
    description: 'Cara router menemukan jalur termurah ke semua tujuan bila peta jaringan diketahui.',
    highlights: ['Cari rute sendiri', 'Simulasi + mode tebak', 'Sandbox ubah bobot'],
    status: 'ready',
  },
  {
    id: 'distance-vector',
    href: './distance-vector.html',
    title: 'Distance Vector — Bellman-Ford',
    topic: 'Network Layer · Control Plane',
    description: 'Router yang hanya bertanya pada tetangga, dan mengapa kabar buruk menyebar lambat.',
    highlights: ['Kalkulator Bellman-Ford', 'Simulator grid 3×3', 'Count-to-infinity'],
    status: 'ready',
  },
  {
    id: 'lsa-flooding',
    href: './lsa-flooding.html',
    title: 'Link-State Flooding & OSPF',
    topic: 'Network Layer · Control Plane',
    description: 'Bagaimana setiap router mendapat peta lengkap, dan apa yang terjadi saat link berubah.',
    highlights: ['Flooding per ronde + mode tebak', 'Nomor urut vs tanpa nomor urut', 'Sandbox link berubah, biaya OSPF, DR/BDR'],
    status: 'ready',
  },
  {
    id: 'error-detection',
    href: './error-detection.html',
    title: 'Deteksi Kesalahan',
    topic: 'Data Link Layer',
    description: 'Parity, CRC, dan checksum Internet: bagaimana penerima tahu bit berubah di jalan.',
    highlights: ['Parity 1D dan 2D yang bisa dirusak', 'CRC langkah demi langkah', 'Siapa mendeteksi apa'],
    status: 'ready',
  },
  {
    id: 'csma-cd',
    href: './csma-cd.html',
    title: 'CSMA/CD dan Backoff',
    topic: 'Data Link Layer',
    description: 'Berbagi satu kabel Ethernet: ALOHA, mendengar sebelum bicara, mendeteksi tabrakan, dan menunggu acak.',
    highlights: ['Efisiensi slotted ALOHA', 'Diagram ruang-waktu tabrakan', 'Backoff eksponensial + mode tebak'],
    status: 'ready',
  },
  {
    id: 'switch-arp',
    href: './switch-arp.html',
    title: 'Switch, ARP & Antar Subnet',
    topic: 'Data Link Layer',
    description: 'Switch yang belajar sendiri, ARP dari IP ke MAC, dan alamat yang berganti di tiap hop router.',
    highlights: ['Flood, forward, filter + mode tebak', 'ARP langkah demi langkah', 'IP tetap, MAC berganti'],
    status: 'ready',
  },
  {
    id: 'tcp-handshake',
    href: './tcp-handshake.html',
    title: 'TCP: Handshake & Penutupan',
    topic: 'Transport Layer',
    description: 'Three-way handshake, nomor urut dan ACK per byte, serta empat langkah menutup koneksi.',
    highlights: ['Handshake + tebak nomor ACK', 'ACK kumulatif dan ACK ganda', 'Status koneksi saat menutup'],
    status: 'ready',
  },
  {
    id: 'dhcp',
    href: './dhcp.html',
    title: 'DHCP',
    topic: 'Application Layer',
    description: 'Dapat alamat IP otomatis: Discover, Offer, Request, Acknowledge, sewa, dan APIPA bila gagal.',
    highlights: ['DORA + tebak pesan berikutnya', 'Timer sewa T1 dan T2', 'Pool alamat habis → APIPA'],
    status: 'ready',
  },
  {
    id: 'rdt',
    href: './rdt.html',
    title: 'Reliable Data Transfer',
    topic: 'Transport Layer',
    description: 'Stop-and-Wait, Go-Back-N, dan Selective Repeat: data tiba utuh lewat kanal yang boleh kehilangan paket.',
    highlights: ['Diagram urutan + mode tebak', 'Utilisasi dan pipelining', 'GBN lawan SR, sandbox kehilangan'],
    status: 'ready',
  },
  {
    id: 'tcp-cc',
    href: './tcp-cc.html',
    title: 'TCP Congestion Control',
    topic: 'Transport Layer',
    description: 'Slow start, AIMD, Tahoe dan Reno, serta mengapa aliran TCP berbagi jaringan dengan adil.',
    highlights: ['AIMD interaktif + mode tebak', 'Tahoe lawan Reno', 'Keadilan dan timer RTT'],
    status: 'ready',
  },
  {
    id: 'lpm',
    href: './lpm.html',
    title: 'Longest Prefix Match',
    topic: 'Network Layer · Data Plane',
    description: 'Memilih satu rute dari banyak yang cocok: prefiks terpanjang, Administrative Distance, lalu metrik.',
    highlights: ['Perbandingan bit demi bit', 'Garis alamat berlapis + mode tebak', 'AD, metrik, dan sandbox'],
    status: 'ready',
  },
  {
    id: 'subnetting',
    href: './subnetting.html',
    title: 'Subnetting, CIDR & VLSM',
    topic: 'Network Layer · Data Plane',
    description: 'Membagi blok alamat IPv4 dengan tepat, dari bit dan prefiks sampai VLSM.',
    highlights: ['Bit, prefiks, dan AND mask', 'Cari blok alamat + mode tebak', 'VLSM langkah demi langkah + sandbox'],
    status: 'ready',
  },
];
