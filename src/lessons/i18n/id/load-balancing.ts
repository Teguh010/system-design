import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Load Balancing',
  summary: 'Satu alamat di depan banyak server: bagaimana load balancer memilih server, mendeteksi kegagalan, dan tidak menjadi titik lemah itu sendiri.',
  metrics: ['algoritme', 'server tersibuk', 'server sehat', 'latency p99'],
  goals: [
    'Apa yang dikerjakan load balancer',
    'Round robin vs least connections',
    'Health check dan mengeluarkan server',
    'Routing layer 4 vs layer 7',
    'Sticky session dan balancer yang redundan',
  ],
  labels: {
    'heavy request': 'request berat',
    'health check': 'health check',
    'hungry users': 'user yang lapar',
    'server 1': 'server 1',
    overloaded: 'kewalahan',
    'busy → fewer new': 'sibuk → lebih sedikit',
    'Round robin': 'Round robin',
    'Health check': 'Health check',
    'GET /healthz   every 5 s': 'GET /healthz   tiap 5 dtk',
    '3 failures  → out': '3 kali gagal → keluar',
    '2 successes → back in': '2 kali sukses → masuk lagi',
    'Routing rules': 'Aturan routing',
    'TLS ends at the balancer': 'TLS berakhir di balancer',
    'pinned users': 'user terkunci',
    'balancer A': 'balancer A',
    'took over': 'mengambil alih',
    'round robin': 'round robin',
    'least connections': 'least connections',
    'L7: route by path': 'L7: routing per path',
    'sticky (cookie)': 'sticky (cookie)',
    '95% (server 1)': '95% (server 1)',
    '80% (server 1)': '80% (server 1)',
    '2.4 s': '2,4 dtk',
  },
  steps: [
    {
      short: 'Satu alamat',
      title: 'Banyak server, satu alamat',
      body: [
        'Pukul 12 siang, API pesan-antar makanan menerima ribuan pesanan per menit, dilayani tiga server yang identik. User tidak mungkin diminta memilih server — mereka hanya tahu satu alamat, <code>api.foodnow.example</code>.',
        'Alamat itu milik sebuah <b>load balancer</b>. Ia menerima setiap koneksi, memilih server untuk setiap request, dan memantau server mana yang sehat. Dua pertanyaan menentukan seberapa baik ia bekerja: <i>bagaimana ia memilih?</i> dan <i>apa yang terjadi saat ada yang gagal?</i>',
      ],
    },
    {
      short: 'Round robin',
      title: 'Round robin',
      body: [
        'Aturan paling sederhana: kirim request 1 ke server 1, request 2 ke server 2, request 3 ke server 3, lalu ulangi. Tanpa state, tanpa pengukuran, <i>jumlah</i> request terbagi rata sempurna.',
        'Kalau setiap request biayanya kira-kira sama dan setiap server ukurannya sama, itu sudah cukup. Variannya, <b>weighted round robin</b>, memberi giliran lebih banyak untuk server yang lebih besar.',
      ],
    },
    {
      short: 'Kerja tak rata',
      title: 'Kasus: tidak semua request sama',
      body: [
        'Sebagian request murah (“daftar restoran terdekat”, 10 ms) dan sebagian mahal (“buat PDF riwayat pesanan”, 2 detik). Round robin menghitung request, bukan beban kerja, jadi beberapa request berat yang mendarat di server 1 menumpuk di sana sementara server 2 dan 3 menganggur.',
        'Antrean server 1 bertambah, dan setiap user yang kebetulan dikirim ke sana ikut menunggu. Rata-ratanya terlihat baik; p99-nya tidak.',
      ],
    },
    {
      short: 'Least conn',
      title: 'Least connections',
      body: [
        'Aturan yang lebih cerdas: kirim setiap request baru ke server dengan <b>request berjalan paling sedikit</b>. Server yang tersendat oleh pekerjaan lambat punya lebih banyak request terbuka, jadi otomatis menerima lebih sedikit yang baru.',
        'Kerabat dekatnya: <b>least response time</b>, dan “power of two choices” — pilih dua server secara acak lalu pakai yang kurang sibuk. Trik terakhir itu mendapat sebagian besar manfaatnya dengan hampir tanpa koordinasi, yang penting kalau ada banyak balancer.',
      ],
      callout: 'Kalau biaya request sangat bervariasi, pilih least connections (atau dua pilihan acak) daripada round robin.',
    },
    {
      short: 'Health check',
      title: 'Health check',
      body: [
        'Setiap beberapa detik balancer memanggil setiap server, biasanya <code>GET /healthz</code>. Setelah beberapa kali gagal berturut-turut, ia menandai server itu <b>tidak sehat</b> dan berhenti merutekan ke sana; setelah beberapa kali sukses, ia mengembalikannya.',
        'Server 3 baru saja crash. Dalam sekitar 15 detik ia sudah keluar dari rotasi, dan user hanya melihat segelintir error. Health check yang baik menguji hal yang penting (bisakah ia mencapai database?) tanpa terlalu ketat sampai gangguan sesaat mengeluarkan semua server sekaligus.',
      ],
    },
    {
      short: 'L4 vs L7',
      title: 'Layer 4 vs layer 7',
      body: [
        'Balancer <b>layer 4</b> hanya melihat koneksi TCP: alamat dan port. Ia sangat cepat dan tidak peduli protokol, tapi tidak bisa melihat isi request.',
        'Balancer <b>layer 7</b> berbicara HTTP. Ia bisa membuka TLS, membaca path dan header, lalu merutekan berdasarkan itu — <code>/api/*</code> ke satu pool, <code>/images/*</code> ke pool lain — dan mengulang request yang gagal di server berbeda. Sebagian besar trafik web saat ini melewati balancer atau proxy L7 seperti NGINX, Envoy, atau ALB di cloud.',
      ],
    },
    {
      short: 'Sticky',
      title: 'Sticky session',
      body: [
        'Sebagian aplikasi menyimpan session user di memori satu server, sehingga balancer diminta mengirim user itu ke server yang sama setiap kali — <b>sticky session</b>, biasanya lewat cookie.',
        'Cara ini berfungsi, tapi melawan tugas balancer: beberapa user berat bisa mengunci satu server, server baru hanya menerima user baru, dan saat server mati user-nya kehilangan session. Sticky hanyalah tambalan karena state berada di tempat yang salah — pelajaran berikutnya memindahkannya keluar.',
      ],
      callout: 'Anggap sticky session sebagai utang teknis, bukan fitur.',
    },
    {
      short: 'Balancer cadangan',
      title: 'Kasus: siapa yang menyeimbangkan balancer?',
      body: [
        'Tiga server sehat tidak ada gunanya kalau satu-satunya load balancer di depannya mati. Balancer itu sendiri harus redundan.',
        'Jawaban yang umum: sepasang balancer yang berbagi <b>floating IP</b> yang pindah ke cadangan saat yang aktif berhenti merespons; beberapa balancer yang terdaftar di DNS; atau balancer terkelola di cloud yang memang sudah berupa armada terdistribusi. Di sini cadangannya mengambil alih dalam beberapa detik.',
      ],
    },
    {
      short: 'Rangkuman',
      title: 'Rangkuman',
      body: [
        'Load balancer mudah ditambahkan dan mudah salah secara halus. Pilihannya:',
        `<table class="compare"><thead><tr><th>pertanyaan</th><th>jawaban umum</th></tr></thead><tbody>
          <tr><td>server mana?</td><td>least connections / dua pilihan acak; round robin kalau beban seragam</td></tr>
          <tr><td>ukuran berbeda?</td><td>bobot (weight)</td></tr>
          <tr><td>kegagalan?</td><td>health check yang mengeluarkan dan memasukkan kembali server</td></tr>
          <tr><td>routing per path atau host?</td><td>balancer layer 7</td></tr>
          <tr><td>session?</td><td>hindari sticky: buat server stateless</td></tr>
          <tr><td>balancer mati?</td><td>pasangan aktif/cadangan, DNS, atau armada terkelola</td></tr></tbody></table>`,
        'Uji dirimu: health check lolos, tapi user di satu server melihat error. Apa yang mungkin terlewat oleh pengecekannya? (Mungkin hanya menguji bahwa prosesnya hidup, bukan bahwa ia bisa mencapai database atau dependency lain.)',
      ],
    },
  ],
};

export default overlay;
