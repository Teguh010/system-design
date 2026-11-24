import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Latency & Throughput',
  summary: 'Dua angka yang menggambarkan setiap sistem saat dibebani — dan kenapa server yang sibuk sudah melambat jauh sebelum ia “penuh”.',
  metrics: ['latency', 'throughput', 'utilisasi', 'sedang diproses'],
  goals: [
    'Membedakan latency dan throughput',
    'Menghitung kapasitas dan pekerjaan yang sedang berjalan (Little’s Law)',
    'Menjelaskan kenapa latency meledak saat utilisasi mendekati penuh',
    'Membaca percentile, bukan rata-rata',
    'Memahami efek fan-out dan batching',
  ],
  labels: {
    'slow / queued': 'lambat / antre',
    'batched write': 'tulis per batch',
    'timed out': 'timeout',
    fans: 'penggemar',
    '1 worker': '1 worker',
    'waiting line': 'antrean',
    growing: 'terus bertambah',
    '100% busy': 'sibuk 100%',
    '90% busy': 'sibuk 90%',
    'slow 1%': 'lambat 1%',
    'Two questions': 'Dua pertanyaan',
    'latency     how long does one take?': 'latency     berapa lama satu request?',
    'throughput  how many per second?': 'throughput  berapa banyak per detik?',
    'related, but not the same': 'berkaitan, tapi tidak sama',
    'One worker': 'Satu worker',
    'work per request   50 ms': 'kerja per request  50 ms',
    'arriving           10/s → 50% busy': 'yang datang        10/s → sibuk 50%',
    '10/s   × 0.05 s  = 0.5 in flight': '10/s   × 0,05 s  = 0,5 diproses',
    '2000/s × 0.2 s   = 400 in flight': '2000/s × 0,2 s   = 400 diproses',
    'size pools with this': 'ukur pool dengan rumus ini',
    'Wait vs. busy': 'Tunggu vs. sibuk',
    'busy  extra wait': 'sibuk tunggu ekstra',
    '50%    1 × work': '50%    1 × kerja',
    '80%    4 × work': '80%    4 × kerja',
    '90%    9 × work': '90%    9 × kerja',
    '95%   19 × work': '95%   19 × kerja',
    '100 requests': '100 request',
    'average   70 ms': 'rata-rata 70 ms',
    'slowest  2,000 ms': 'terlambat 2.000 ms',
    ' 1 × 2,000 ms': ' 1 × 2.000 ms',
    'ticket API': 'API tiket',
    profile: 'profil',
    payment: 'pembayaran',
    seats: 'kursi',
    pricing: 'harga',
    fraud: 'fraud',
    'inventory db': 'db inventori',
    'Writes per second': 'Tulis per detik',
    '1 per round trip   ~500/s': '1 per round trip   ~500/s',
    '50 per batch       ~10,000/s': '50 per batch       ~10.000/s',
    '+ up to 5 ms wait per order': '+ tunggu s.d. 5 ms per pesanan',
    '30 s and rising': '30 dtk dan naik',
    '10/s (max 20)': '10/s (maks 20)',
    '20/s (max)': '20/s (maks)',
    '30/s (max 80)': '30/s (maks 80)',
    'avg 70 ms · max 2 s': 'rata² 70 ms · maks 2 dtk',
    '5% of pages slow': '5% halaman lambat',
    '~10k writes/s': '~10rb tulis/s',
    '+5 ms per order': '+5 ms per pesanan',
    '0.5': '0,5',
    '2.4': '2,4',
    'worker 1': 'worker 1',
  },
  steps: [
    {
      short: 'Dua angka',
      title: 'Dua angka yang berbeda',
      body: [
        'Tiket konser mulai dijual pukul 10.00 dan ribuan penggemar menyerbu API tiket bersamaan. Dua angka menggambarkan bagaimana sistem menghadapinya. <b>Latency</b> adalah berapa lama seorang penggemar menunggu jawaban. <b>Throughput</b> adalah berapa banyak jawaban yang dihasilkan sistem per detik.',
        'Bayangkan jalan tol: latency adalah berapa lama perjalananmu; throughput adalah berapa banyak mobil yang melewati sebuah jembatan per jam. Jalan bisa dilewati banyak mobil tapi tetap lambat, atau kosong dan cepat.',
      ],
      callout: 'Memperbaiki yang satu tidak otomatis memperbaiki yang lain. Selalu tanyakan masalahnya soal yang mana.',
    },
    {
      short: 'Kapasitas',
      title: 'Kapasitas satu worker',
      body: [
        'Misalkan setiap request butuh 50 ms waktu CPU dan API mengerjakan satu request dalam satu waktu. Worker itu paling banyak menyelesaikan 1000 ÷ 50 = <b>20 request per detik</b>, secepat apa pun request berdatangan.',
        'Batas atas itu adalah <b>kapasitas</b>-nya. Dengan 10 request per detik, worker sibuk separuh waktu, dan satu request butuh sekitar 50 ms ditambah waktu jaringan. Yang menarik adalah apa yang terjadi saat kedatangan mendekati batas itu.',
      ],
    },
    {
      short: 'Sedang jalan',
      title: 'Little’s Law: pekerjaan yang sedang berjalan',
      body: [
        'Satu aturan sederhana mengikat angka-angka ini: <b>jumlah item di dalam sistem = laju kedatangan × waktu tiap item di dalamnya</b>, ditulis L = λ × W. Sepuluh request per detik yang masing-masing butuh 0,05 detik berarti, rata-rata, ada setengah request yang sedang diproses.',
        'Aturan ini berlaku untuk apa saja — thread, koneksi database, pembeli di toko. Kalau 2.000 request per detik masing-masing butuh 0,2 detik, kamu butuh ruang untuk 400 sekaligus. Pakai untuk menentukan ukuran thread pool, connection pool, dan batas konkurensi.',
      ],
    },
    {
      short: 'Kelebihan beban',
      title: 'Permintaan melampaui kapasitas',
      body: [
        'Tepat pukul 10.00, 30 request per detik tiba di worker yang hanya sanggup menyelesaikan 20. Setiap detik, sepuluh request lebih banyak yang masuk antrean daripada yang keluar. Antrean tumbuh tanpa batas, begitu pula waktu tunggunya: setelah satu menit, request baru mengantre di belakang 600 request lain — 30 detik. Banyak penggemar menyerah dan request mereka timeout.',
        'Tidak ada yang rusak; server bekerja dengan kecepatan penuh. Sistemnya <b>kelebihan beban</b> (overload), dan saat overload latency ditentukan oleh antrean, bukan oleh pekerjaannya.',
      ],
      callout: 'Throughput tidak bisa melampaui kapasitas. Kelebihannya berubah menjadi waktu tunggu.',
    },
    {
      short: 'Titik tekuk',
      title: 'Titik tekuk pada kurva',
      body: [
        'Masalah sudah muncul jauh sebelum 100%. Request tidak datang merata; mereka datang bergerombol. Dengan kedatangan acak, rata-rata waktu menunggu di antrean tumbuh sebesar <b>ρ ÷ (1 − ρ)</b> kali waktu layanan, dengan ρ adalah utilisasi.',
        'Saat sibuk 50%, kamu menunggu sekitar satu kali waktu layanan tambahan. Pada 80%, empat kali. Pada 90%, sembilan. Pada 95%, sembilan belas. Kurvanya datar, lalu melonjak — itulah “titik tekuk”-nya. Karena itu tim biasanya menargetkan sekitar 60–70% saat puncak, bukan 95%.',
      ],
      callout: 'Ruang cadangan (headroom) bukan pemborosan. Itulah yang menjaga latency tetap datar saat trafik bergerombol.',
    },
    {
      short: 'Tambah worker',
      title: 'Tambah worker',
      body: [
        'Kapasitas bertambah seiring jumlah worker. Tambah tiga lagi, semuanya mengambil request berikutnya dari antrean yang sama, sehingga tidak ada yang menganggur sementara yang lain kewalahan. Empat worker bisa menyelesaikan 80 request per detik; dengan 30 yang datang, masing-masing sibuk di bawah 40% dan berada di bagian kurva yang datar. Antrean surut dan latency turun kembali mendekati biaya pekerjaannya.',
        'Kapasitas tambahan menyembuhkan overload. Tapi itu tidak membantu request yang memang lambat dengan sendirinya — yang itu butuh query lebih cepat atau kerja lebih sedikit per request.',
      ],
    },
    {
      short: 'Percentile',
      title: 'Rata-rata menyembunyikan penderitaan',
      body: [
        'Rata-rata menyembunyikan orang-orang yang menderita. Kalau 99 request butuh 50 ms dan satu butuh 2 detik, rata-ratanya 70 ms yang terlihat nyaman — padahal satu dari seratus penggemar menatap ikon loading.',
        'Laporkan <b>percentile</b>. p50 adalah request yang umum; p99 adalah batas 1% yang paling lambat. Satu kali membuka halaman bisa memicu puluhan request, jadi p99 yang buruk akan dialami hampir semua pengunjung di hampir setiap kunjungan.',
      ],
      callout: 'Tetapkan target pada p95 atau p99, bukan rata-rata. Rata-rata adalah angka yang tidak dialami siapa pun.',
    },
    {
      short: 'Fan-out',
      title: 'Kasus: fan-out melipatgandakan ekor',
      body: [
        'Untuk membangun halaman checkout, API memanggil lima layanan secara paralel dan menunggu semuanya. Masing-masing hanya lambat 1% dari waktu. Tapi halaman jadi lambat kalau <i>salah satu</i> saja lambat: 1 − 0,99⁵ ≈ <b>5% halaman</b>. Dengan 20 layanan, angkanya 18%.',
        'Fan-out mengubah ekor yang jarang menjadi hal yang sering. Pertahanannya: lebih sedikit panggilan di critical path, timeout dengan fallback yang masuk akal, dan mengirim request cadangan saat request pertama terlambat (<b>hedging</b>).',
      ],
    },
    {
      short: 'Batching',
      title: 'Batching: throughput ditukar latency',
      body: [
        'Setiap tiket yang terjual harus ditulis ke database inventori. Satu penulisan per round trip membatasi satu koneksi di beberapa ratus penulisan per detik. Mengelompokkan 50 pesanan dalam satu penulisan menaikkan throughput secara drastis — dengan harga setiap pesanan menunggu beberapa milidetik sampai batch-nya penuh.',
        'Batching muncul di mana-mana: producer Kafka, group commit di database, inferensi GPU. Kenopnya selalu bekerja sama: batch lebih besar, throughput lebih tinggi, menunggu lebih lama.',
      ],
    },
    {
      short: 'Rangkuman',
      title: 'Rangkuman',
      body: [
        'Aturan praktis dari pelajaran ini muat dalam satu kartu:',
        `<table class="compare"><thead><tr><th>ide</th><th>aturan praktis</th></tr></thead><tbody>
          <tr><td>kapasitas</td><td>jumlah worker ÷ kerja per request</td></tr>
          <tr><td>Little’s Law</td><td>sedang diproses = laju × waktu</td></tr>
          <tr><td>overload</td><td>di atas kapasitas, antrean menentukan latency</td></tr>
          <tr><td>titik tekuk</td><td>tunggu ≈ ρ ÷ (1 − ρ); rencanakan sibuk 60–70%</td></tr>
          <tr><td>percentile</td><td>target di p95/p99, bukan rata-rata</td></tr>
          <tr><td>fan-out</td><td>1 − (1 − p)ⁿ request kena ekor</td></tr>
          <tr><td>batching</td><td>throughput naik, latency sedikit naik</td></tr></tbody></table>`,
        'Uji dirimu: sebuah API rata-rata menerima 200 request per detik dengan 100 ms per request. Berapa request yang sedang diproses sekaligus, dan apa yang terjadi pada latency kalau trafik naik dua kali lipat tapi kapasitas tidak? (20 sedang diproses; kalau beban yang berlipat itu mendekati kapasitas, latency naik tajam, tidak linear.)',
      ],
    },
  ],
};

export default overlay;
