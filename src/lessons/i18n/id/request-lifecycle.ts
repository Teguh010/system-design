import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Perjalanan Sebuah Request',
  summary: 'Ikuti satu klik dari browser sampai ke database dan kembali lagi, lalu beri ukuran waktu di setiap lompatannya.',
  metrics: ['DNS lookup', 'koneksi', 'waktu server', 'halaman siap'],
  goals: [
    'Mengubah nama domain menjadi alamat lewat DNS',
    'Menghitung round trip sebelum byte pertama tiba',
    'Melihat apa yang terjadi di dalam data center',
    'Menjelaskan kenapa file statis dan kunjungan ulang lebih murah',
    'Menemukan lompatan paling lambat di critical path',
  ],
  labels: {
    'lookup / handshake': 'lookup / handshake',
    'slow response': 'response lambat',
    browser: 'browser',
    'somewhere out there': 'entah di mana',
    'app server': 'server aplikasi',
    database: 'database',
    'static files, 5 ms away': 'file statis, 5 ms dari user',
    'third-party script': 'skrip pihak ketiga',
    'cache warm': 'cache hangat',
    'One click': 'Satu klik',
    'you click   news.example/today': 'kamu klik   news.example/today',
    'page shows  ~0.5 s later': 'halaman muncul ~0,5 dtk kemudian',
    'what happened in between?': 'apa yang terjadi di antaranya?',
    'DNS answer': 'Jawaban DNS',
    'cached by resolver, OS, browser': 'di-cache resolver, OS, browser',
    'Before any data': 'Sebelum ada data',
    'TLS  certificate + keys     1 RTT': 'TLS  sertifikat + kunci     1 RTT',
    'RTT 30 ms → 60 ms of waiting': 'RTT 30 ms → 60 ms menunggu',
    'Time to first byte': 'Time to first byte',
    'request trip    30 ms': 'perjalanan req  30 ms',
    'server work     25 ms': 'kerja server    25 ms',
    '~0.5 s': '~0,5 dtk',
    '~0.2 s': '~0,2 dtk',
    '~2.5 s': '~2,5 dtk',
    '0 ms (cached)': '0 ms (cache)',
    '0 ms (reused)': '0 ms (dipakai ulang)',
    '2 s': '2 dtk',
  },
  steps: [
    {
      short: 'Satu klik',
      title: 'Satu klik, lalu sebuah halaman',
      body: [
        'Kamu mengklik sebuah judul berita di <code>news.example</code>, dan sekitar setengah detik kemudian artikelnya sudah tampil. Setengah detik itu menyimpan banyak sekali pekerjaan: pencarian nama, dua kali handshake, perjalanan melewati beberapa mesin, dan satu query database.',
        'Pelajaran ini mengikuti satu request dari awal sampai akhir dan memberi ukuran waktu di setiap lompatannya. Begitu kamu bisa melihat ke mana waktunya habis, kamu tahu harus melihat ke mana saat sebuah halaman terasa lambat.',
      ],
      callout: 'Hampir semua pertanyaan performa dimulai dengan “lompatan mana yang lambat?” Kamu hanya bisa menjawabnya kalau tahu lompatan-lompatannya.',
    },
    {
      short: 'DNS',
      title: 'Dari nama ke angka: DNS',
      body: [
        'Jaringan merutekan berdasarkan alamat IP, bukan nama. Browser memeriksa cache-nya sendiri, lalu cache sistem operasi. Kalau tidak ketemu, ia bertanya ke <b>recursive resolver</b> — biasanya milik ISP atau layanan publik — yang menelusuri hierarki DNS (root, lalu <code>.example</code>, lalu server <b>authoritative</b> milik domain itu) dan mengembalikan alamat seperti <code>203.0.113.7</code>.',
        'Lookup pertama (cold) butuh beberapa round trip, sering 20–100 ms. Jawabannya membawa <b>TTL</b>, jadi selama beberapa waktu lookup berikutnya dijawab dari cache dalam waktu jauh di bawah satu milidetik.',
      ],
      callout: 'TTL pendek memudahkanmu memindahkan trafik dengan cepat saat insiden; TTL panjang membuat lookup lebih murah. Tentukan per record.',
    },
    {
      short: 'Handshake',
      title: 'Handshake sebelum data',
      body: [
        'Sebelum satu byte pun dari halaman bergerak, kedua sisi menyiapkan koneksi. <b>TCP</b> menyepakati nomor urut dalam satu round trip. <b>TLS</b> lalu membuktikan bahwa server itu benar-benar <code>news.example</code> dan menyepakati kunci enkripsi — satu round trip lagi dengan TLS 1.3.',
        'Kalau server berjarak 30 ms, itu berarti 60 ms murni menunggu. Bandwidth tidak membantu di sini: handshake hanyalah beberapa pesan kecil, dan masing-masing membayar satu round trip penuh.',
      ],
      callout: 'Round-trip time (RTT) adalah satuan latency di jaringan. Hitung jumlah round trip-nya, lalu kalikan.',
    },
    {
      short: 'Pintu depan',
      title: 'Masuk lewat pintu depan',
      body: [
        'Alamat tadi biasanya milik sebuah <b>load balancer</b> atau reverse proxy, bukan aplikasinya langsung. Ia membuka TLS, memilih server aplikasi yang sehat, lalu meneruskan request HTTP: <code>GET /today</code>, beserta header dan cookie.',
        'Di dalam data center, lompatan itu murah — sekitar setengah milidetik masing-masing — jadi tambahan satu lapisan proxy nyaris tidak terasa dibanding perjalanan dari browsermu.',
      ],
    },
    {
      short: 'Kerjanya',
      title: 'Aplikasi mengerjakan tugasnya',
      body: [
        'Server aplikasi mem-parse request, memeriksa session, lalu meminta artikel hari ini ke database. Query yang ber-index dengan baik butuh beberapa milidetik; me-render HTML butuh beberapa milidetik lagi.',
        'Perhatikan betapa kecilnya angka-angka ini dibanding jaringan. Request pada umumnya lebih lama di perjalanan daripada saat dikerjakan.',
      ],
    },
    {
      short: 'Pulang',
      title: 'Byte dalam perjalanan pulang',
      body: [
        'HTML mengalir kembali lewat jalan yang sama. Saat byte pertamanya tiba disebut <b>time to first byte</b> (TTFB): kira-kira DNS + handshake + satu round trip untuk request + waktu server. Di sini sekitar 155 ms.',
        'Browser langsung mulai mem-parse — dan menyadari ia butuh lebih banyak: stylesheet, skrip, font, dan gambar.',
      ],
      callout: 'TTFB adalah angka yang perlu kamu pantau untuk backend. Sebagian besar yang terjadi setelahnya adalah urusan front-end dan jaringan.',
    },
    {
      short: 'Banyak file',
      title: 'Satu halaman, banyak file',
      body: [
        'Halaman berita bisa dengan mudah butuh 60 file lagi. Mengambilnya satu per satu akan melipatgandakan round trip, jadi browser membuka beberapa koneksi sekaligus dan HTTP/2 menggabungkan banyak request dalam satu koneksi.',
        'File statis tidak berubah untuk tiap pembaca, jadi ia dilayani dari <b>CDN</b>: jaringan cache yang ditempatkan dekat dengan user. Node CDN yang berjarak 5 ms mengubah setiap pengambilan 30 ms menjadi 5 ms, sekaligus melepaskan beban itu dari server-servermu.',
      ],
    },
    {
      short: 'Kunjungan ulang',
      title: 'Kunjungan ulang lebih murah',
      body: [
        'Buka artikel kedua, dan sebagian besar pekerjaan tadi hilang. Jawaban DNS masih ada di cache, koneksinya tetap hidup (keep-alive), dan cache browser sudah menyimpan stylesheet, font, dan logo. Hanya HTML baru dan gambar baru yang perlu dikirim.',
        'Karena itulah performa kunjungan pertama dan kunjungan ulang diukur terpisah: bedanya sering dua sampai tiga kali lipat.',
      ],
    },
    {
      short: 'Pihak ketiga',
      title: 'Kasus: skrip pihak ketiga',
      body: [
        'Halaman itu juga memuat skrip dari partner iklan. Server mereka sedang bermasalah — dua detik per response — dan skripnya dipasang dengan cara yang memblokir rendering. Server milikmu sendiri sehat-sehat saja, tapi pembaca hanya melihat halaman kosong.',
        'Apa pun yang berada di <b>critical path</b> menentukan kecepatan seluruh halaman. Muat kode pihak ketiga secara asinkron, beri timeout, dan pastikan halaman tetap bisa tampil tanpanya.',
      ],
      callout: 'Kamu ikut menanggung latency dan gangguan dari setiap dependency yang ada di critical path-mu.',
    },
    {
      short: 'Rangkuman',
      title: 'Perjalanan lengkapnya',
      body: [
        'Satu klik, banyak lompatan. Simpan tabel ini sebagai checklist saat sebuah halaman terasa lambat:',
        `<table class="compare"><thead><tr><th>lompatan</th><th>biaya umum</th><th>cara mengecilkannya</th></tr></thead><tbody>
          <tr><td>DNS lookup</td><td>20–100 ms (cold)</td><td>caching lewat TTL, penyedia DNS yang cepat</td></tr>
          <tr><td>TCP + TLS</td><td>2 round trip</td><td>keep-alive, TLS 1.3, server lebih dekat ke user</td></tr>
          <tr><td>proxy → app</td><td>&lt; 1 ms</td><td>biasanya tidak perlu diapa-apakan</td></tr>
          <tr><td>kerja server</td><td>5–50 ms</td><td>index, caching, kerja lebih sedikit per request</td></tr>
          <tr><td>file statis</td><td>1 RTT per file</td><td>CDN, cache browser, file lebih sedikit</td></tr>
          <tr><td>pihak ketiga</td><td>tergantung mereka</td><td>muat asinkron, timeout, fallback</td></tr></tbody></table>`,
        'Uji dirimu: kenapa pembaca yang berjarak 200 ms lebih menderita karena handshake daripada karena gambar besar? (Handshake terdiri dari beberapa round trip; file besar terutama dibatasi oleh bandwidth.)',
      ],
      callout: 'Latency itu penjumlahan. Tulis daftar komponennya, cari yang terbesar, dan kecilkan yang itu dulu.',
    },
  ],
};

export default overlay;
