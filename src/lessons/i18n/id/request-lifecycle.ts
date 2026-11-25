import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Perjalanan Sebuah Request',
  summary: 'Ikuti satu klik dari browser sampai ke database dan kembali lagi, beri ukuran waktu di setiap lompatannya, dan temukan kenapa sebagian pembaca menunggu berdetik-detik.',
  metrics: ['DNS', 'koneksi', 'request + server', 'download', 'halaman siap'],
  goals: [
    'Mengubah nama domain menjadi alamat lewat DNS',
    'Menghitung round trip sebelum data mulai bergerak',
    'Membaca isi sebuah HTTP request',
    'Menjumlahkan ke mana waktu muat halaman habis',
    'Membedakan dua sumber utama kelambatan: kerja dan jarak',
  ],
  labels: {
    'lookup / handshake': 'lookup / handshake',
    slow: 'lambat',
    you: 'kamu',
    'reader far away': 'pembaca yang jauh',
    'mobile, other continent': 'seluler, benua lain',
    'web server': 'web server',
    'cached · 5 min': 'di-cache · 5 mnt',
    'somewhere out there': 'entah di mana',
    click: 'klik',
    'Reader complaints': 'Keluhan pembaca',
    'usually opens in ~0.4 s': 'biasanya terbuka ~0,4 dtk',
    'some readers wait 2 s or more': 'sebagian pembaca menunggu 2 dtk lebih',
    'where does the time go?': 'ke mana waktunya habis?',
    'not cached: ask': 'belum di-cache: tanya',
    'HTML · first byte at 155 ms': 'HTML · byte pertama di 155 ms',
    '40 files · HTTP/2': '40 file · HTTP/2',
    'SELECT author × 40': 'SELECT penulis × 40',
    '41 queries · 410 ms': '41 query · 410 ms',
    '30 ms + work': '30 ms + kerja',
    '0.4 s … 2 s+': '0,4 dtk … 2 dtk+',
    '1,000 ms': '1.000 ms',
    '~2.0 s': '~2,0 dtk',
    '500 error': '500 error',
    'error page': 'halaman error',
    timeout: 'timeout',
    'site down': 'situs mati',
  },
  steps: [
    {
      short: 'Terasa lambat',
      title: 'Pembaca bilang situsnya lambat',
      body: [
        'Sebuah situs berita, <code>news.example</code>, terus menerima keluhan: “artikelnya lama sekali terbuka”. Hasil tes tim sendiri terlihat baik — sekitar 0,4 detik dari klik sampai halaman tampil. Tapi jelas ada pembaca yang menunggu dua detik atau lebih.',
        'Untuk mencari tahu kenapa, ikuti satu request sejak pembaca mengklik sebuah judul sampai artikelnya tampil di layar, dan beri ukuran waktu di setiap lompatan. Bilah di atas diagram akan menjumlahkan lompatan-lompatan itu sepanjang jalan.',
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
      changes: ['+ browser bertanya ke resolver soal news.example'],
    },
    {
      short: 'Koneksi',
      title: 'Membuka koneksi',
      body: [
        'Sebelum satu byte pun dari artikel bergerak, kedua sisi menyiapkan koneksi. <b>TCP</b> menyepakati nomor urut dalam satu round trip. <b>TLS</b> lalu membuktikan bahwa server itu benar-benar <code>news.example</code> dan menyepakati kunci enkripsi — satu round trip lagi dengan TLS 1.3.',
        'Kalau server berjarak 30 ms, itu berarti 60 ms murni menunggu. Bandwidth tidak membantu di sini: handshake hanyalah beberapa pesan kecil, dan masing-masing membayar satu round trip penuh. Perhatikan resolver tetap di tempatnya — jawabannya sekarang sudah di-cache.',
      ],
      callout: 'Round-trip time (RTT) adalah satuan latency di jaringan. Hitung jumlah round trip-nya, lalu kalikan.',
      changes: ['+ jawaban DNS di-cache selama 5 menit', '+ handshake TCP + TLS: 2 round trip @ 30 ms'],

    },
    {
      short: 'Request',
      title: 'Mengirim request',
      body: [
        'Sekarang browser mengirim sebuah <b>HTTP request</b>: beberapa ratus byte teks yang menyebut <b>method</b> (<code>GET</code>), <b>path</b> (artikelnya), dan <b>header</b> — nama host, bahasa pilihan pembaca, dan cookie yang mengenali session-nya.',
        'Request itu berjalan lewat koneksi yang sudah terbuka, jadi butuh setengah round trip untuk sampai. Server membacanya, memeriksa cookie, lalu menentukan apa yang harus ia hasilkan.',
      ],
      changes: ['+ request GET lewat koneksi yang terbuka (15 ms sekali jalan)'],
    },
    {
      short: 'Ambil data',
      title: 'Server bertanya ke database',
      body: [
        'Teks artikel, penulis, dan komentarnya tersimpan di database. Web server mengirim beberapa query lewat koneksi di dalam data center, tempat satu round trip hanya sekitar setengah milidetik. Query yang ber-index dengan baik selesai dalam beberapa milidetik; me-render HTML butuh beberapa milidetik lagi.',
        'Perhatikan betapa kecilnya angka-angka ini dibanding jaringan: sekitar 25 ms kerja, dengan CPU yang nyaris santai. Request pada umumnya lebih lama di perjalanan daripada saat dikerjakan — selama server mengerjakan jumlah kerja yang wajar.',
      ],
      changes: ['+ 3 query di dalam data center, ~25 ms kerja'],
      chaos: {
        db: 'Web server masih menjawab, tapi tidak bisa menyusun artikel tanpa datanya. Pembaca mendapat halaman error — atau menunggu timeout kalau server terus mencoba. Satu dependensi mati, halaman ini ikut mati.',
        web: 'DNS masih menunjuk ke <code>203.0.113.7</code>, tapi tidak ada yang menjawab di sana. Browser menunggu koneksi sampai menyerah. Dengan satu server, satu kegagalan berarti seluruh situs mati — Modul 02 menaruh beberapa server di balik satu alamat.',
        resolver: 'Belum terjadi apa-apa. Browser sudah punya alamatnya, di-cache selama 5 menit. Saat TTL itu habis, pengunjung baru tidak bisa menemukan situsnya walaupun server-nya sehat.',
      },
    },
    {
      short: 'Response',
      title: 'Response kembali',
      body: [
        'HTML mengalir kembali lewat jalan yang sama. Saat byte pertamanya tiba disebut <b>time to first byte</b> (TTFB): DNS + handshake + perjalanan request + kerja server, di sini sekitar 155 ms. Sisa HTML-nya menyusul dalam ~15 ms.',
        'Browser langsung mulai menggambar — dan sambil membaca HTML-nya, ia menyadari butuh lebih banyak lagi.',
      ],
      callout: 'TTFB adalah angka yang perlu kamu pantau untuk backend. Sebagian besar yang terjadi setelahnya adalah urusan front-end dan jaringan.',
      changes: ['+ HTML tiba: byte pertama setelah ~155 ms'],
    },
    {
      short: 'File lain',
      title: 'Satu halaman, empat puluh file lagi',
      body: [
        'HTML itu merujuk stylesheet, skrip, font, dan gambar — sekitar empat puluh file. Mengambilnya satu per satu akan memakan empat puluh round trip, jadi browser meminta banyak sekaligus; dengan HTTP/2 semuanya berbagi koneksi yang sudah terbuka.',
        'File-file itu tetap butuh beberapa round trip — sebagian baru ketahuan setelah file lain tiba — ditambah waktu mengunduh byte-nya. Jumlahkan bilahnya: 40 + 60 + 55 + 245 ≈ 400 ms. Itulah 0,4 detik yang diukur tim.',
      ],
      changes: ['+ 40 file lagi lewat koneksi yang sama'],
    },
    {
      short: 'Query lambat',
      title: 'Kasus: empat puluh satu query untuk satu halaman',
      body: [
        'Satu kelompok keluhan datang dari artikel populer. Bagian komentarnya memuat daftar komentar, lalu mencari setiap penulis komentar dengan query terpisah: 1 query untuk daftar ditambah 40 untuk penulisnya. Dengan ~10 ms masing-masing, itu sekitar 410 ms, dan setiap pembaca artikel itu ikut menunggunya.',
        'Lihat server-nya: CPU-nya malah <i>lebih santai</i> dari sebelumnya, karena waktunya habis untuk menunggu. Inilah masalah klasik <b>N+1 query</b>. Satu query yang mengambil komentar beserta penulisnya sekaligus mengembalikan waktu server ke normal. Jaringan sama, handshake sama — perbaikannya ada di cara mengakses database.',
      ],
      callout: 'Ukur dulu sebelum mengoptimalkan. Kalau jaringan baik-baik saja tapi kolom server membengkak, hitung query-nya sebelum membeli hardware.',
      changes: ['+ komentar mencari setiap penulis terpisah: 40 query tambahan', '~ CPU server turun — ia menunggu, bukan bekerja'],

    },
    {
      short: 'Jauh',
      title: 'Kasus: pembaca yang jauh',
      body: [
        'Keluhan terparah datang dari pembaca yang memakai jaringan seluler di benua lain. Round trip-nya ke server sekitar 300 ms, bukan 30. Setiap round trip dalam daftar tadi sekarang sepuluh kali lebih mahal: dua untuk handshake, satu untuk request, dan beberapa untuk file yang ditemukan di sepanjang jalan.',
        'Time to first byte saja sudah lewat satu detik, dan halamannya baru tampil setelah dua detik. Servernya sama cepatnya seperti sebelumnya — waktunya habis karena jarak. Mengurangi round trip dan menaruh konten lebih dekat ke pembaca adalah solusinya, dan menjadi topik pelajaran-pelajaran berikutnya.',
      ],
      callout: 'Latency punya dua sumber besar: kerja di server dan jarak di jaringan. Keduanya butuh solusi yang berbeda.',
      changes: ['+ pembaca dengan round trip 300 ms', '~ N+1 sudah diperbaiki: kerja server kembali normal', '~ setiap round trip 10× lebih mahal'],

    },
    {
      short: 'Rangkuman',
      title: 'Ke mana waktunya habis',
      body: [
        'Satu klik, beberapa lompatan, dan satu bilah yang menjumlahkannya. Simpan tabel ini sebagai checklist saat sebuah halaman terasa lambat:',
        `<table class="compare"><thead><tr><th>lompatan</th><th>biaya umum</th><th>lambat kalau…</th><th>lihat</th></tr></thead><tbody>
          <tr><td>DNS lookup</td><td>20–100 ms (cold)</td><td>belum ada yang di-cache</td><td>pelajaran ini</td></tr>
          <tr><td>TCP + TLS</td><td>2 round trip</td><td>pembacanya jauh</td><td>CDN</td></tr>
          <tr><td>request + server</td><td>1 round trip + kerja</td><td>query terlalu banyak atau tanpa index</td><td>Caching, Indeks</td></tr>
          <tr><td>download</td><td>beberapa round trip</td><td>file ditemukan satu per satu</td><td>Caching, CDN</td></tr></tbody></table>`,
        'Uji dirimu: pembaca yang berjarak 200 ms mengeluh, dan waktu servermu 20 ms. Mana yang lebih membantu — database yang lebih cepat atau round trip yang lebih sedikit? (Round trip yang lebih sedikit: masing-masing memakan sepuluh kali seluruh waktu server.)',
      ],
      callout: 'Latency itu penjumlahan. Tulis daftar komponennya, cari yang terbesar, dan kecilkan yang itu dulu.',
    },
  ],
};

export default overlay;
