import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Scaling Vertikal vs Horizontal',
  summary: 'Saat satu server tidak cukup, kamu bisa membeli yang lebih besar atau menambah jumlahnya. Masing-masing punya batas dan harga.',
  metrics: ['beban cpu', 'kapasitas', 'biaya bulanan', 'titik gagal tunggal'],
  goals: [
    'Scale up: apa yang didapat dari mesin yang lebih besar',
    'Kenapa scaling vertikal mentok di batas atas',
    'Scale out: menambah mesin di belakang load balancer',
    'Apa harga kompleksitas dari scale out',
    'Menggabungkan keduanya di sistem nyata',
  ],
  labels: {
    students: 'pelajar',
    'app server': 'server aplikasi',
    'bigger server': 'server lebih besar',
    'biggest server': 'server terbesar',
    'bigger database': 'database lebih besar',
    'Bigger costs more per core': 'Makin besar, makin mahal per core',
    '  4 cores    $150 / month': '  4 core     $150 / bulan',
    ' 16 cores    $650': ' 16 core     $650',
    ' 64 cores  $2,800': ' 64 core   $2.800',
    '192 cores  $9,500': '192 core   $9.500',
    'illustrative prices': 'harga ilustrasi',
    'What you now need': 'Yang sekarang kamu butuhkan',
    'load balancer (+ a spare)': 'load balancer (+ cadangan)',
    'deploys to N servers': 'deploy ke N server',
    'monitoring for N servers': 'monitoring untuk N server',
    'servers must be stateless': 'server harus stateless',
    yes: 'ya',
    'yes — down': 'ya — mati',
    '45% each': '45% per server',
    '3× (add more)': '3× (bisa ditambah)',
    '70% on 2': '70% di 2 server',
    'no (app tier)': 'tidak (lapisan app)',
    '3× app, 2× db': '3× app, 2× db',
    'the database': 'database-nya',
    '$5,000+': '$5.000+',
    '$1,350': '$1.350',
    '$2,250': '$2.250',
  },
  steps: [
    {
      short: 'Mulai penuh',
      title: 'Satu server mulai kewalahan',
      body: [
        '<b>StudyHub</b>, situs bantuan PR, berjalan di satu server aplikasi dan satu database. Sepanjang semester semuanya lancar. Sekarang musim ujian datang, trafik naik dua kali lipat, dan server bertahan di 85% CPU setiap malam — tepat di titik tekuk kurva latency.',
        'Ada dua cara menambah kapasitas: membuat mesinnya <b>lebih besar</b> (scale up, atau scaling <i>vertikal</i>) atau menambah <b>lebih banyak</b> mesin (scale out, atau scaling <i>horizontal</i>). Pelajaran ini mencoba keduanya.',
      ],
      callout: 'Scaling itu soal kapasitas dan soal kegagalan. Ingat keduanya saat membandingkan pilihan.',
    },
    {
      short: 'Scale up',
      title: 'Scale up: mesin yang lebih besar',
      body: [
        'Perbaikan tercepat adalah instance yang lebih besar: core dua kali lipat, memori dua kali lipat. Tidak ada kode yang berubah — tidak ada kotak baru, tidak ada mode gagal baru, tidak perlu load balancer. Restart di hardware baru dan grafik CPU turun ke 40%.',
        'Untuk banyak sistem, ini langkah pertama yang tepat. Server modern sangat besar, dan satu mesin yang di-tuning dengan baik bisa menanggung jauh lebih banyak daripada yang dibutuhkan kebanyakan produk.',
      ],
      callout: 'Sebelum menambah mesin, cek apakah mesin yang lebih besar menyelesaikan masalah untuk setahun ke depan. Yang sederhana menang.',
    },
    {
      short: 'Batas atas',
      title: 'Scale up punya batas atas',
      body: [
        'Terus gandakan, dan dua hal terjadi. Harga naik lebih cepat daripada kapasitas: mesin terbesar dijual lebih mahal, jadi setiap core tambahan lebih mahal dari sebelumnya. Dan akhirnya memang tidak ada lagi mesin yang lebih besar untuk dibeli.',
        'Sebagian batas datang lebih cepat daripada CPU: bandwidth jaringan satu host, jumlah koneksi terbuka, berapa lama restart atau rebuild disk di mesin raksasa. Kamu bisa menundanya, bukan menghilangkannya.',
      ],
    },
    {
      short: 'Satu kotak mati',
      title: 'Kasus: satu kotak besar itu mati',
      body: [
        'Pukul 21.00 di malam sebelum ujian, power supply server besar itu rusak. Setiap pelajar mendapat error. Sekuat apa pun satu mesin, ia tetap <b>satu</b> mesin: titik gagal tunggal.',
        'Restart di hardware baru butuh beberapa menit; memulihkan database yang crash bisa butuh berjam-jam. Scaling vertikal memberi kapasitas, tapi tidak memberi redundansi.',
      ],
      callout: 'Kapasitas dan ketersediaan adalah masalah berbeda. Mesin yang lebih besar menyelesaikan yang pertama dan membuat yang kedua lebih mahal.',
    },
    {
      short: 'Scale out',
      title: 'Scale out: lebih banyak mesin',
      body: [
        'Daripada satu server raksasa, jalankan tiga server biasa di belakang <b>load balancer</b>. Load balancer memberi user satu alamat dan menyebar request mereka ke server-server itu.',
        'Kapasitas sekarang tumbuh bertahap dan bisa dibeli satu per satu, dan biaya naik kira-kira linear: tiga mesin kecil berharga sekitar tiga kali satu mesin kecil. Butuh lebih untuk pekan ujian? Tambah dua lagi, lalu lepas setelahnya.',
      ],
    },
    {
      short: 'Harganya',
      title: 'Scale out juga ada harganya',
      body: [
        'Lebih banyak mesin berarti lebih banyak bagian yang bergerak. Kamu butuh load balancer (dan cadangannya), cara deploy ke setiap server, dan monitoring yang mencakup semuanya.',
        'Yang paling penting, server-servernya harus bisa saling menggantikan: request bisa mendarat di mana saja, jadi tidak boleh ada server yang menyimpan sesuatu yang penting hanya di memori atau disk-nya sendiri. Aturan desain itu — server <b>stateless</b> — dibahas di pelajaran berikutnya dalam modul ini.',
      ],
    },
    {
      short: 'Kehilangan satu',
      title: 'Kehilangan satu tidak masalah',
      body: [
        'Sekarang power supply yang sama rusak di app 2. Load balancer melihat health check yang gagal dan berhenti mengirim trafik ke sana. App 1 dan 3 menanggung beban di 70% masing-masing; pelajar tidak merasakan apa-apa.',
        'Inilah hadiah sesungguhnya dari scale out: <b>redundansi</b>. Rencanakan “N + 1” — cukup server sehingga kehilangan satu pun masih menyisakan kapasitas yang cukup.',
      ],
      callout: 'Ukur armadamu supaya tetap bertahan saat kehilangan anggota terbesarnya di puncak trafik.',
    },
    {
      short: 'Keduanya',
      title: 'Sistem nyata memakai keduanya',
      body: [
        'Server aplikasi yang stateless mudah di-scale out, jadi biasanya memang begitu. Database lebih sulit: memecah data ke banyak mesin membawa kompleksitas nyata (lihat <i>Sharding</i> nanti). Jadi database sering di-scale <b>up</b> lebih dulu, ditambah replika untuk baca dan failover.',
        'Jalur yang umum: satu kotak → kotak lebih besar → banyak server aplikasi + satu database besar → read replica → sharding, setiap langkah hanya saat angka-angkanya menuntut.',
      ],
    },
    {
      short: 'Rangkuman',
      title: 'Rangkuman',
      body: [
        'Dua arah, dua kumpulan trade-off yang berbeda:',
        `<table class="compare"><thead><tr><th></th><th>scale up</th><th>scale out</th></tr></thead><tbody>
          <tr><td>caranya</td><td>mesin lebih besar</td><td>lebih banyak mesin + load balancer</td></tr>
          <tr><td>perubahan kode</td><td class="good">tidak ada</td><td>server harus stateless</td></tr>
          <tr><td>batas atas</td><td class="bad">mesin terbesar yang bisa dibeli</td><td class="good">jauh lebih tinggi</td></tr>
          <tr><td>kurva biaya</td><td class="bad">naik lebih cepat dari kapasitas</td><td class="good">kira-kira linear</td></tr>
          <tr><td>kegagalan</td><td class="bad">satu mati = semua mati</td><td class="good">satu hilang, tetap melayani</td></tr></tbody></table>`,
        'Uji dirimu: database-mu di 80% CPU dan lapisan aplikasi di 30%. Mana yang di-scale, dan bagaimana? (Database-nya — kemungkinan scale up dulu, karena memecah data adalah langkah yang mahal; menambah server aplikasi tidak akan membantu.)',
      ],
    },
  ],
};

export default overlay;
