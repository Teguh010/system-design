import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Merancang URL Shortener',
  summary: 'Dari brief satu kalimat sampai layanan yang mengubah miliaran kode pendek menjadi redirect dalam beberapa milidetik.',
  metrics: ['waktu redirect', 'baca db', 'kode pendek', 'skala'],
  goals: [
    'Mengubah brief menjadi kebutuhan dan angka',
    'Membuat kode yang tidak pernah bentrok dan tidak bisa ditebak',
    'Mempercepat redirect dengan cache',
    'Menyebar miliaran baris ke banyak mesin',
    'Menjauhkan analytics dan pengecekan abuse dari jalur utama',
  ],
  labels: {
    'cache miss': 'cache miss',
    'write / click event': 'tulis / event klik',
    'id block': 'blok ID',
    abuse: 'abuse',
    users: 'user',
    'to be designed': 'akan dirancang',
    'app server': 'server aplikasi',
    'code → long_url': 'kode → long_url',
    'hands out ID blocks': 'membagikan blok ID',
    'hot codes in RAM': 'kode populer di RAM',
    'click queue': 'antrean klik',
    'stats store': 'penyimpanan statistik',
    'clicks + URL scanning': 'klik + pemindaian URL',
    'spam bots': 'bot spam',
    'collision!': 'bentrok!',
    enumerating: 'menelusuri',
    Requirements: 'Kebutuhan',
    'create  long URL → code': 'buat    URL panjang → kode',
    'open    code → redirect': 'buka    kode → redirect',
    'later: expiry, click counts': 'nanti: kedaluwarsa, hitung klik',
    'redirects: fast, always up': 'redirect: cepat, selalu hidup',
    'Napkin math': 'Hitungan kasar',
    'writes   120M/mo ≈ 46/s': 'tulis    120 jt/bln ≈ 46/s',
    'reads    × 80   ≈ 3.7k/s': 'baca     × 80   ≈ 3,7rb/s',
    'peak     × 3    ≈ 11k/s': 'puncak   × 3    ≈ 11rb/s',
    'storage  7.2B × 400 B ≈ 3 TB': 'storage  7,2 M × 400 B ≈ 3 TB',
    'same code, two URLs': 'kode sama, dua URL',
    'never collides': 'tidak pernah bentrok',
    'unique, not guessable': 'unik, tidak bisa ditebak',
    '301  cached by the browser': '301  di-cache browser',
    'cheap, but clicks vanish': 'murah, tapi klik hilang',
    '302  every click comes back': '302  setiap klik kembali',
    'analytics, editable': 'ada analytics, bisa diubah',
    '11k/s peak · 3 TB': 'puncak 11rb/s · 3 TB',
    'every click': 'setiap klik',
    '1 server': '1 server',
    'hash → collisions': 'hash → bentrok',
    guessable: 'bisa ditebak',
    '~10% of clicks': '~10% klik',
    '~2 ms (unchanged)': '~2 ms (tetap)',
    '3 apps · 3 shards': '3 app · 3 shard',
  },
  steps: [
    {
      short: 'Brief',
      title: 'Brief: bangun sebuah link shortener',
      body: [
        'Pelajaran ini memakai ide-ide sebelumnya untuk satu desain utuh. Tugasnya: layanan seperti bit.ly. Seseorang menempelkan URL panjang dan mendapat URL pendek seperti <code>sho.rt/k3X9pQz</code>. Siapa pun yang membuka link pendek itu akan sampai di halaman aslinya.',
        'Mulai dari kebutuhan, bukan kotak-kotak. <b>Wajib</b>: membuat link pendek, dan melakukan redirect. <b>Bagus kalau ada</b>: link yang bisa kedaluwarsa, hitungan klik. <b>Kualitas</b>: redirect harus cepat dan nyaris tidak boleh gagal — kalau shortener mati, setiap link yang pernah ia buat ikut mati. Membuat link boleh sedikit lebih lambat.',
      ],
      callout: 'Tiga pertanyaan membuka setiap desain: apa yang harus dilakukan, seberapa banyak, dan kualitas mana yang menang kalau tidak bisa semuanya?',
    },
    {
      short: 'Angka',
      title: 'Beri angka',
      body: [
        'Hitungan kasar dulu sebelum arsitektur. Anggap ada <b>120 juta</b> link baru sebulan — kira-kira 46 penulisan per detik. Kalau satu link dibuka sekitar 80 kali sepanjang umurnya, redirect rata-rata sekitar 3.700 per detik; dengan puncak harian 3×, sekitar <b>11.000 per detik</b>.',
        'Simpan link selama lima tahun: 120 juta × 60 bulan ≈ 7,2 miliar baris. Dengan ~400 byte per baris, totalnya hampir <b>3 TB</b>. Dua hal menonjol: pembacaan 80 kali lebih banyak daripada penulisan, dan datanya besar tapi bentuknya sangat sederhana — satu key, satu value.',
      ],
      callout: 'Biarkan angka yang memilih arsitekturnya. Rasio baca/tulis yang timpang mengarah ke caching; terabyte baris key → value mengarah ke partisi.',
    },
    {
      short: 'Draf pertama',
      title: 'Hal paling sederhana yang berfungsi',
      body: [
        'Satu server aplikasi, satu database. Tabelnya cukup punya dua kolom penting: <code>code</code> (primary key) dan <code>long_url</code>. Membuat link berarti memasukkan satu baris; redirect berarti lookup berdasarkan primary key lalu mengirim HTTP redirect.',
        'Ini sanggup menangani beberapa ratus klik per detik dengan nyaman. Selalu gambar versi ini lebih dulu — inilah patokan yang harus dikalahkan setiap kotak tambahan.',
      ],
    },
    {
      short: 'Hash?',
      title: 'Dari mana kodenya? Coba hashing',
      body: [
        'Ide yang paling jelas: hash URL panjangnya (misalnya MD5) dan ambil 7 karakter pertama. URL yang sama selalu mendapat kode yang sama, dan tidak ada server yang perlu berkoordinasi dengan server lain.',
        'Masalahnya adalah <b>bentrok</b> (collision). Tujuh karakter base62 memberi 62⁷ ≈ 3,5 triliun kode, kedengarannya banyak sekali. Tapi paradoks ulang tahun mengatakan bentrok sudah muncul jauh sebelum ruangnya penuh — dengan 7 miliar link kamu bisa mengharapkan jutaan bentrok. Setiap pembuatan link berubah menjadi <i>insert, bentrok, hash ulang, coba lagi</i>, dan dua server bisa berebut kode yang sama.',
      ],
      callout: 'Memotong hash membuang sifat yang justru membuatnya menarik: input berbeda menghasilkan output berbeda.',
    },
    {
      short: 'Hitung saja',
      title: 'Hitung, lalu encode',
      body: [
        'Balik caranya: beri setiap link baru sebuah bilangan bulat unik, lalu tulis angka itu dalam base62 (<code>0-9 a-z A-Z</code>). Angka yang berbeda menghasilkan kode yang berbeda, jadi tidak ada yang perlu dicek dan tidak ada yang perlu diulang.',
        'Satu counter global akan menjadi bottleneck sekaligus titik gagal tunggal, jadi sebuah <b>ID service</b> membagikan <b>blok</b>: server aplikasi memesan ID 5.000.000–5.000.999 dalam satu panggilan lalu memakainya secara lokal. Kalau server crash, beberapa ID yang belum terpakai terlewat begitu saja — tidak masalah.',
        'Bahkan 7,2 miliar hanya butuh 6 karakter; 7 karakter cukup untuk 3,5 triliun link.',
      ],
      callout: 'Kalau butuh nilai unik dari banyak mesin, berkoordinasilah jarang-jarang dan sekaligus banyak — pesan rentang, jangan minta satu per satu.',
    },
    {
      short: 'Bisa ditebak',
      title: 'Kasus: kode yang bisa dihitung',
      body: [
        'Lihat kartu di langkah sebelumnya: <code>7RgsUg</code> diikuti <code>7RgsUh</code>. Kode berurutan itu bocor. Sebuah skrip bisa menelusuri seluruh ruang kode dan memanen link yang dikira privat — dokumen bersama, invoice, halaman reset password.',
        'Perbaiki tanpa mengorbankan keunikan: acak counter-nya dengan fungsi yang <b>bisa dibalik</b> sebelum di-encode — kalikan dengan konstanta ganjil besar modulo 62⁷, atau jalankan Feistel cipher kecil. Setiap ID tetap memetakan ke tepat satu kode, tapi kode yang bertetangga tidak lagi terlihat bertetangga.',
      ],
      callout: 'Unik dan tidak bisa ditebak adalah dua kebutuhan berbeda. Counter memberimu yang pertama; pengacakan satu-ke-satu menambahkan yang kedua.',
    },
    {
      short: 'Cache',
      title: 'Pembacaan mendominasi: cache saja',
      body: [
        'Klik sangat tidak merata: sebagian kecil link mendapat sebagian besar trafik. Dan pemetaan kode → URL <b>tidak pernah berubah</b> setelah ditulis. Itulah beban kerja yang sempurna untuk cache.',
        'Pasang cache di memori (Redis, Memcached) di depan database. Cache hit kembali dalam waktu jauh di bawah satu milidetik; hanya cache miss yang sampai ke database, yang lalu mengisi ulang cache di perjalanan pulang. Dengan hit rate 90%, database hanya melihat sepersepuluh klik.',
        'Karena pemetaannya tidak berubah, tidak ada pusingnya invalidasi — kecuali saat link dihapus atau kedaluwarsa, dan cukup hapus key-nya.',
      ],
      callout: 'Data yang tidak berubah adalah hal termudah di dunia untuk di-cache. Cari data seperti itu di setiap desain.',
    },
    {
      short: '301 atau 302',
      title: 'Redirect yang mana: 301 atau 302?',
      body: [
        '<b>301 Moved Permanently</b> membolehkan browser mengingat redirect-nya. Pengunjung yang datang lagi melewati server-servermu sama sekali — lebih murah dan lebih cepat — tapi kamu berhenti melihat klik mereka, dan kamu tidak akan pernah bisa mengubah tujuan link itu bagi mereka.',
        '<b>302 Found</b> (atau 307) bersifat sementara: setiap klik kembali kepadamu. Beban lebih besar, tapi analytics akurat, dan kamu bebas mengubah, mengedaluwarsakan, atau memblokir link nanti.',
        `<table class="compare"><thead><tr><th></th><th>301</th><th>302</th></tr></thead><tbody>
          <tr><td>beban server</td><td class="good">lebih rendah</td><td>setiap klik</td></tr>
          <tr><td>analytics klik</td><td class="bad">hilang setelah kunjungan pertama</td><td class="good">lengkap</td></tr>
          <tr><td>ubah / blokir nanti</td><td class="bad">tidak bisa</td><td class="good">bisa</td></tr></tbody></table>`,
      ],
      callout: 'Sebagian besar shortener komersial memilih 302. Bagi mereka, klik itulah produknya.',
    },
    {
      short: 'Scale out',
      title: 'Tiga terabyte: sebar saja',
      body: [
        '3 TB dan 11.000 pembacaan per detik saat puncak tidak akan nyaman di satu mesin — dan satu mesin berarti satu kegagalan saja sudah merusak setiap link yang pernah dibagikan. Skalakan kedua lapisannya.',
        '<b>Server aplikasi</b> tidak menyimpan state, jadi pasang beberapa di belakang <b>load balancer</b> dan tambah saat dibutuhkan. <b>Data</b> dipartisi berdasarkan hash dari kodenya: setiap shard memiliki sebagian key, dan satu lookup hanya menyentuh tepat satu shard. Setiap shard juga punya replika supaya disk yang mati tidak berarti link yang mati.',
        'Lookup berdasarkan primary key tanpa join adalah hal yang memang menjadi keahlian DynamoDB atau Cassandra; Postgres yang di-shard juga bisa.',
      ],
      callout: 'Shard berdasarkan key yang kamu pakai untuk mencari. Semua query di sini berbunyi “berikan kode X”, jadi kodenya adalah shard key.',
    },
    {
      short: 'Klik',
      title: 'Menghitung klik tanpa memperlambatnya',
      body: [
        'Analytics harus berada di luar jalur redirect. Kalau setiap redirect menunggu update counter di sebuah database, penyimpanan analytics yang lambat akan membuat setiap link di internet yang mengarah kepadamu ikut lambat.',
        'Sebagai gantinya, aplikasi menaruh sebuah <b>event klik</b> kecil — kode, waktu, negara, referrer — ke dalam antrean (Kafka, SQS) lalu langsung menjawab. <b>Worker</b> mengonsumsi event per batch dan memperbarui penyimpanan statistik. Kalau worker tertinggal, klik dihitung sedikit terlambat; redirect tidak merasakan apa-apa.',
      ],
      callout: 'Tanyakan untuk setiap pekerjaan: apakah user harus menunggu ini? Kalau tidak, pindahkan keluar dari jalur request.',
    },
    {
      short: 'Abuse',
      title: 'Kasus: spammer menyukai shortener',
      body: [
        'Link pendek menyembunyikan ke mana ia sebenarnya pergi, sehingga shortener menjadi alat favorit untuk phishing dan malware. Bot juga menggempur endpoint pembuatan link untuk mencetak jutaan link sekali pakai.',
        'Bertahanlah berlapis. <b>Rate-limit</b> pembuatan link per akun dan per IP di load balancer. <b>Pindai</b> URL baru terhadap blocklist secara asinkron — antrean dan worker-nya sudah ada. Kalau sebuah link ternyata berbahaya, alihkan ke halaman peringatan — satu lagi alasan memilih 302.',
      ],
      callout: 'Endpoint tulis yang publik dan gratis pasti menjadi sasaran abuse. Anggarkan dalam desain, jangan setelah insiden.',
    },
    {
      short: 'Rangkuman',
      title: 'Desain akhirnya',
      body: [
        'Setiap kotak di panggung ada karena sebuah angka atau sebuah kegagalan memintanya:',
        `<table class="compare"><thead><tr><th>keputusan</th><th>pilihan</th><th>karena</th></tr></thead><tbody>
          <tr><td>kode pendek</td><td>base62(shuffle(id))</td><td>unik tanpa pengecekan, tidak bisa ditebak</td></tr>
          <tr><td>alokasi ID</td><td>blok dari ID service</td><td>tanpa koordinasi per request</td></tr>
          <tr><td>jalur baca</td><td>cache di depan storage</td><td>80 baca per tulis, data tidak berubah</td></tr>
          <tr><td>redirect</td><td>302</td><td>analytics dan kendali atas link</td></tr>
          <tr><td>storage</td><td>shard berdasarkan kode, direplikasi</td><td>3 TB, lookup satu key</td></tr>
          <tr><td>analytics, pemindaian</td><td>antrean + worker</td><td>jalur utama tetap ramping</td></tr></tbody></table>`,
        'Uji dirimu: bisakah kamu menjelaskan kenapa jalur redirect tidak pernah menyentuh antrean, dan apa yang terjadi pada sebuah klik kalau semua worker mati? (Ia menunggu di antrean; redirect tetap berjalan.)',
      ],
      callout: 'Pernyataan masalah yang sederhana menyembunyikan sebagian besar desainnya. Pekerjaannya ada di angka, kasus kegagalan, dan trade-off.',
    },
  ],
};

export default overlay;
