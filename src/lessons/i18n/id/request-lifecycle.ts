import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Perjalanan Sebuah Request',
  summary: 'Ikuti satu klik dari browser sampai ke database dan kembali lagi, beri ukuran waktu di setiap lompatannya, dan temukan kenapa sebagian pembaca menunggu berdetik-detik.',
  metrics: ['DNS lookup', 'koneksi', 'waktu server', 'halaman siap'],
  goals: [
    'Mengubah nama domain menjadi alamat lewat DNS',
    'Menghitung round trip sebelum data mulai bergerak',
    'Membaca isi sebuah HTTP request',
    'Mengukur time to first byte',
    'Membedakan dua sumber utama kelambatan: kerja dan jarak',
  ],
  labels: {
    'lookup / handshake': 'lookup / handshake',
    slow: 'lambat',
    'web server': 'web server',
    'somewhere out there': 'entah di mana',
    'reader far away': 'pembaca yang jauh',
    'Reader complaints': 'Keluhan pembaca',
    'usually opens in ~0.4 s': 'biasanya terbuka ~0,4 dtk',
    'some readers wait 2 s or more': 'sebagian pembaca menunggu 2 dtk lebih',
    'where does the time go?': 'ke mana waktunya habis?',
    'DNS answer': 'Jawaban DNS',
    'cached by resolver, OS, browser': 'di-cache resolver, OS, browser',
    'Before any data': 'Sebelum ada data',
    'TLS  certificate + keys     1 RTT': 'TLS  sertifikat + kunci     1 RTT',
    'RTT 30 ms → 60 ms of waiting': 'RTT 30 ms → 60 ms menunggu',
    'request trip    30 ms': 'perjalanan req  30 ms',
    'server work     25 ms': 'kerja server    25 ms',
    'waiting on db': 'menunggu db',
    '41 queries': '41 query',
    '0.4 s … 2 s+': '0,4 dtk … 2 dtk+',
    '~0.4 s': '~0,4 dtk',
    '~0.8 s': '~0,8 dtk',
    '~2 s+': '~2 dtk+',
  },
  steps: [
    {
      short: 'Terasa lambat',
      title: 'Pembaca bilang situsnya lambat',
      body: [
        'Sebuah situs berita, <code>news.example</code>, terus menerima keluhan: “artikelnya lama sekali terbuka”. Hasil tes tim sendiri terlihat baik — sekitar 0,4 detik dari klik sampai halaman tampil. Tapi jelas ada pembaca yang menunggu dua detik atau lebih.',
        'Untuk mencari tahu kenapa, ikuti satu request sejak pembaca mengklik sebuah judul sampai artikelnya tampil di layar, dan beri ukuran waktu di setiap lompatan sepanjang jalan.',
      ],
      callout: 'Kamu baru bisa memperbaiki “lambat” kalau tahu lompatan mana yang lambat. Mulailah dengan mendaftar lompatannya.',
    },
    {
      short: 'Cari alamat',
      title: 'Mencari alamat: DNS',
      body: [
        'Jaringan merutekan berdasarkan alamat IP, bukan nama. Browser memeriksa cache-nya sendiri, lalu cache sistem operasi. Kalau tidak ketemu, ia bertanya ke <b>recursive resolver</b> — biasanya milik ISP atau layanan publik — yang menelusuri hierarki DNS (root, lalu <code>.example</code>, lalu server <b>authoritative</b> milik domain itu) dan mengembalikan alamat seperti <code>203.0.113.7</code>.',
        'Lookup pertama (cold) butuh beberapa round trip, sering 20–100 ms. Jawabannya membawa <b>TTL</b>, jadi selama beberapa waktu lookup berikutnya dijawab dari cache dalam waktu jauh di bawah satu milidetik.',
      ],
      callout: 'TTL pendek memudahkanmu memindahkan trafik dengan cepat saat insiden; TTL panjang membuat lookup lebih murah. Tentukan per record.',
    },
    {
      short: 'Koneksi',
      title: 'Membuka koneksi',
      body: [
        'Sebelum satu byte pun dari artikel bergerak, kedua sisi menyiapkan koneksi. <b>TCP</b> menyepakati nomor urut dalam satu round trip. <b>TLS</b> lalu membuktikan bahwa server itu benar-benar <code>news.example</code> dan menyepakati kunci enkripsi — satu round trip lagi dengan TLS 1.3.',
        'Kalau server berjarak 30 ms, itu berarti 60 ms murni menunggu. Bandwidth tidak membantu di sini: handshake hanyalah beberapa pesan kecil, dan masing-masing membayar satu round trip penuh.',
      ],
      callout: 'Round-trip time (RTT) adalah satuan latency di jaringan. Hitung jumlah round trip-nya, lalu kalikan.',
    },
    {
      short: 'Request',
      title: 'Mengirim request',
      body: [
        'Sekarang browser mengirim sebuah <b>HTTP request</b>: beberapa ratus byte teks yang menyebut <b>method</b> (<code>GET</code>), <b>path</b> (artikelnya), dan <b>header</b> — nama host, bahasa pilihan pembaca, dan cookie yang mengenali session-nya.',
        'Request itu berjalan lewat koneksi yang sudah terbuka, jadi butuh setengah round trip untuk sampai. Server membacanya, memeriksa cookie, lalu menentukan apa yang harus ia hasilkan.',
      ],
    },
    {
      short: 'Ambil data',
      title: 'Server bertanya ke database',
      body: [
        'Teks artikel, penulis, dan komentarnya tersimpan di database. Web server mengirim beberapa query lewat koneksi di dalam data center, tempat satu round trip hanya sekitar setengah milidetik. Query yang ber-index dengan baik selesai dalam beberapa milidetik; me-render HTML butuh beberapa milidetik lagi.',
        'Perhatikan betapa kecilnya angka-angka ini dibanding jaringan. Request pada umumnya lebih lama di perjalanan daripada saat dikerjakan — selama server mengerjakan jumlah kerja yang wajar.',
      ],
    },
    {
      short: 'Response',
      title: 'Response kembali',
      body: [
        'HTML mengalir kembali lewat jalan yang sama. Saat byte pertamanya tiba disebut <b>time to first byte</b> (TTFB): kira-kira DNS + handshake + satu round trip untuk request + waktu server. Di sini sekitar 155 ms.',
        'Browser langsung mulai menggambar — dan sambil membaca HTML-nya, ia menyadari butuh lebih banyak lagi.',
      ],
      callout: 'TTFB adalah angka yang perlu kamu pantau untuk backend. Sebagian besar yang terjadi setelahnya adalah urusan front-end dan jaringan.',
    },
    {
      short: 'File lain',
      title: 'Satu halaman, empat puluh file lagi',
      body: [
        'HTML itu merujuk stylesheet, skrip, font, dan gambar — sekitar empat puluh file. Mengambilnya satu per satu akan memakan empat puluh round trip, jadi browser meminta banyak sekaligus; dengan HTTP/2 semuanya berbagi koneksi yang sudah terbuka.',
        'File yang pernah dilihat browser diambil dari cache-nya sendiri dan tidak memakan biaya. Halaman siap di sekitar 0,4 detik: TTFB ditambah beberapa round trip untuk semua yang dibutuhkannya.',
      ],
    },
    {
      short: 'Query lambat',
      title: 'Kasus: empat puluh satu query untuk satu halaman',
      body: [
        'Sebagian keluhan datang dari artikel populer. Bagian komentarnya memuat setiap komentar, lalu mencari setiap penulis komentar dengan query terpisah: 1 query untuk daftar ditambah 40 untuk penulisnya. Dengan ~10 ms masing-masing, itu sekitar 400 ms waktu server, dan setiap pembaca artikel itu ikut membayarnya.',
        'Inilah masalah klasik <b>N+1 query</b>. Satu query yang mengambil komentar beserta penulisnya sekaligus mengembalikan waktu server ke ~30 ms. Pelajarannya berlaku umum: kalau TTFB tinggi padahal jaringan baik-baik saja, ukur apa yang sedang dikerjakan server.',
      ],
      callout: 'Halaman lambat karena server biasanya berarti terlalu banyak kerja per request, bukan mesin yang lambat. Hitung query-nya sebelum membeli hardware.',
    },
    {
      short: 'Jauh',
      title: 'Kasus: pembaca yang jauh',
      body: [
        'Keluhan terparah datang dari pembaca yang memakai jaringan seluler di benua lain. Round trip-nya ke server sekitar 300 ms, bukan 30. Setiap round trip dalam daftar tadi sekarang sepuluh kali lebih mahal: dua untuk handshake, satu untuk request, dan beberapa lagi untuk file yang ditemukan di sepanjang jalan.',
        'Time to first byte saja sudah lewat satu detik, dan halamannya baru tampil setelah dua detik. Servernya sama cepatnya seperti sebelumnya — waktunya habis karena jarak. Mengurangi round trip dan menaruh konten lebih dekat ke pembaca adalah solusinya, dan menjadi topik pelajaran-pelajaran berikutnya.',
      ],
      callout: 'Latency punya dua sumber besar: kerja di server dan jarak di jaringan. Keduanya butuh solusi yang berbeda.',
    },
    {
      short: 'Rangkuman',
      title: 'Ke mana waktunya habis',
      body: [
        'Satu klik, beberapa lompatan. Simpan tabel ini sebagai checklist saat sebuah halaman terasa lambat:',
        `<table class="compare"><thead><tr><th>lompatan</th><th>biaya umum</th><th>lambat kalau…</th><th>lihat</th></tr></thead><tbody>
          <tr><td>DNS lookup</td><td>20–100 ms (cold)</td><td>belum ada yang di-cache</td><td>pelajaran ini</td></tr>
          <tr><td>TCP + TLS</td><td>2 round trip</td><td>pembacanya jauh</td><td>CDN</td></tr>
          <tr><td>request / response</td><td>1 round trip</td><td>pembacanya jauh</td><td>CDN</td></tr>
          <tr><td>kerja server</td><td>5–50 ms</td><td>query terlalu banyak atau tanpa index</td><td>Caching, Indeks</td></tr>
          <tr><td>file lain</td><td>beberapa round trip</td><td>file ditemukan satu per satu</td><td>Caching, CDN</td></tr></tbody></table>`,
        'Uji dirimu: pembaca yang berjarak 200 ms mengeluh, dan waktu servermu 20 ms. Mana yang lebih membantu — database yang lebih cepat atau round trip yang lebih sedikit? (Round trip yang lebih sedikit: masing-masing memakan sepuluh kali seluruh waktu server.)',
      ],
      callout: 'Latency itu penjumlahan. Tulis daftar komponennya, cari yang terbesar, dan kecilkan yang itu dulu.',
    },
  ],
};

export default overlay;
