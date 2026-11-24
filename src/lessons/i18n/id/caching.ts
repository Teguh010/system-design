import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Caching',
  summary: 'Simpan jawaban yang sudah pernah dihitung supaya dekat di tangan — lalu hadapi dua bagian sulitnya: data basi dan stampede.',
  metrics: ['hit rate', 'baca db / s', 'rata² baca', 'maks. basi'],
  goals: [
    'Memakai pola cache-aside',
    'Menghitung nilai sebuah hit rate',
    'Memilih expiry dan eviction',
    'Menjaga data cache tetap segar setelah penulisan',
    'Bertahan dari thundering herd',
  ],
  labels: {
    'cache miss': 'cache miss',
    write: 'tulis',
    visitors: 'pengunjung',
    'app server': 'server aplikasi',
    '90% busy': 'sibuk 90%',
    'Hit rate → load': 'Hit rate → beban',
    'hit   db share  avg read': 'hit   porsi db  rata² baca',
    'TTL 5 min · LRU': 'TTL 5 mnt · LRU',
    Eviction: 'Eviction',
    'TTL   drop after 5 min': 'TTL   buang setelah 5 mnt',
    'LRU   full? drop least recent': 'LRU   penuh? buang yg terlama dipakai',
    'LFU   full? drop least used': 'LFU   penuh? buang yg paling jarang',
    admin: 'admin',
    'still €49': 'masih €49',
    'now €39': 'sekarang €39',
    'write-through': 'write-through',
    'key expired': 'key kedaluwarsa',
    overloaded: 'kewalahan',
    'browser cache': 'cache browser',
    'in-process cache': 'cache in-process',
    Layers: 'Lapisan',
    '5,000': '5.000',
    '1.6 ms': '1,6 ms',
    '0.6 ms': '0,6 ms',
    '≤ 5 min': '≤ 5 mnt',
    'up to 5 min': 'sampai 5 mnt',
    '≈ 0 (on write)': '≈ 0 (saat tulis)',
    '0% (expired)': '0% (kedaluwarsa)',
    '2,000 at once': '2.000 sekaligus',
    timeouts: 'timeout',
    '90%   1/10      ~1.7 ms': '90%   1/10      ~1,7 ms',
    '99%   1/100     ~0.6 ms': '99%   1/100     ~0,6 ms',
    '99.9% 1/1000    ~0.5 ms': '99,9% 1/1000    ~0,5 ms',
    'Redis          ~0.5 ms': 'Redis          ~0,5 ms',
  },
  steps: [
    {
      short: 'Pertanyaan sama',
      title: 'Pertanyaan yang sama, lagi dan lagi',
      body: [
        'Halaman produk sebuah toko menampilkan nama, harga, foto, dan stok. Ribuan pengunjung membuka 500 produk populer yang sama setiap menit, dan setiap tampilan menjalankan query database yang sama untuk data yang hanya berubah beberapa kali sehari.',
        'Database di 90% dan terus naik. Sebagian besar kerjanya menghasilkan jawaban yang sudah ia hasilkan sedetik sebelumnya.',
      ],
    },
    {
      short: 'Cache-aside',
      title: 'Cache-aside',
      body: [
        'Pasang cache di memori di samping aplikasi. Untuk setiap baca: lihat cache dulu. Kalau <b>hit</b>, langsung kembalikan. Kalau <b>miss</b>, query database, simpan hasilnya di cache, lalu kembalikan.',
        'Inilah <b>cache-aside</b> (atau lazy loading): aplikasi yang mengatur cache, dan hanya data yang benar-benar diminta yang masuk ke dalamnya. Sebagian besar pembacaan sekarang tidak pernah sampai ke database.',
      ],
      callout: 'Cache hasil yang dibutuhkan halaman (seluruh tampilan produk), bukan setiap query kecil di belakangnya. Lebih sedikit key, lebih banyak hit.',
    },
    {
      short: 'Hitung hit rate',
      title: 'Berapa nilai sebuah hit rate',
      body: [
        'Beban database adalah miss rate dikali trafik. Dengan 90% hit, database melihat 1 dari 10 pembacaan; dengan 99%, 1 dari 100. Naik dari 90% ke 99% kelihatannya kecil, tapi memangkas beban database 10× lagi.',
        'Rata-rata latency adalah campuran berbobot: dengan cache 0,5 ms dan database 12 ms, hit 90% memberi 0,9 × 0,5 + 0,1 × 12 ≈ 1,7 ms. Miss mendominasi rata-rata, jadi beberapa persen terakhir hit rate layak dikejar.',
      ],
    },
    {
      short: 'Expiry',
      title: 'Expiry dan eviction',
      body: [
        'Memori terbatas, jadi dua aturan menentukan apa yang tetap tinggal. <b>TTL</b> (time to live) membuang entri setelah, misalnya, lima menit, sehingga data cache tidak bisa terlalu tua. <b>Kebijakan eviction</b> menentukan apa yang dibuang saat cache penuh — biasanya <b>LRU</b>, yang paling lama tidak dipakai.',
        'Ukur cache untuk <i>hot set</i>-nya, bukan seluruh database: kalau 500 produk mendapat 90% tampilan, menyimpan beberapa megabyte itu sudah menangkap hampir semua manfaatnya.',
      ],
    },
    {
      short: 'Harga basi',
      title: 'Kasus: harga yang basi',
      body: [
        'Admin menurunkan harga ketel dari €49 menjadi €39 untuk flash sale. Database langsung diperbarui, tapi halaman produk di cache masih menampilkan €49 sampai lima menit. Pembeli melihat satu harga dan ditagih harga lain.',
        'Dua perbaikan, biasanya digabung: setiap kali menulis, <b>hapus</b> (atau perbarui) key cache-nya supaya pembacaan berikutnya memuat ulang; dan pertahankan TTL sebagai jaring pengaman kalau suatu invalidasi terlewat.',
      ],
      callout: 'Setiap cache adalah salinan, dan salinan bisa melenceng. Tentukan seberapa basi tiap jenis data boleh — harga dan stok jarang bisa ditoleransi.',
    },
    {
      short: 'Jalur tulis',
      title: 'Write-through dan write-behind',
      body: [
        'Cache-aside melakukan invalidasi saat menulis. Dua pola lain mengalirkan penulisan lewat cache itu sendiri. <b>Write-through</b>: tulis ke cache dan database bersamaan, sehingga cache selalu segar, dengan harga penulisan lebih lambat. <b>Write-behind</b>: tulis ke cache lalu salurkan ke database belakangan per batch — sangat cepat, tapi cache yang crash bisa menghilangkan penulisan.',
        `<table class="compare"><thead><tr><th>pola</th><th>kesegaran</th><th>kecepatan tulis</th><th>risiko</th></tr></thead><tbody>
          <tr><td>cache-aside + hapus</td><td>baik</td><td class="good">cepat</td><td>miss sesaat setelah tulis</td></tr>
          <tr><td>write-through</td><td class="good">terbaik</td><td>lebih lambat</td><td>menyimpan data yang tak dibaca</td></tr>
          <tr><td>write-behind</td><td class="good">terbaik</td><td class="good">tercepat</td><td class="bad">bisa kehilangan tulisan</td></tr></tbody></table>`,
      ],
    },
    {
      short: 'Herd',
      title: 'Kasus: thundering herd',
      body: [
        'Key “promo hari ini” di halaman utama kedaluwarsa pukul 12:00:00. Dalam 50 ms berikutnya, 2.000 request miss bersamaan, dan semuanya menjalankan query mahal yang sama. Database macet, query timeout, dan cache tidak pernah terisi lagi — sebuah <b>cache stampede</b>.',
        'Pertahanannya: biarkan hanya satu request yang membangun ulang key yang hilang sementara yang lain menunggu (<b>request coalescing</b>, “single flight”); tambahkan jitter acak ke TTL supaya key tidak kedaluwarsa bersamaan; atau sajikan nilai lama sementara satu worker memperbaruinya di latar belakang.',
      ],
      callout: '“Stale-while-revalidate” sering menjadi jawaban terbaik: promo yang sedikit basi jauh lebih baik daripada halaman error.',
    },
    {
      short: 'Lapisan',
      title: 'Cache di setiap lapisan',
      body: [
        'Redis hanyalah satu cache di antara banyak. Browser menyimpan gambar dan skrip; CDN menyimpan response utuh dekat user; aplikasi bisa punya cache in-process kecil untuk key yang paling panas; database menyimpan halaman yang baru dipakai di buffer pool-nya; disk pun punya cache sendiri.',
        'Setiap lapisan lebih cepat dan lebih kecil daripada lapisan di bawahnya. Desain yang baik menentukan dengan sengaja apa yang boleh disimpan setiap lapisan dan untuk berapa lama.',
      ],
    },
    {
      short: 'Rangkuman',
      title: 'Rangkuman',
      body: [
        'Cache mengubah pekerjaan berulang menjadi lookup memori. Sisanya adalah mengelola salinannya:',
        `<table class="compare"><thead><tr><th>pertanyaan</th><th>jawaban umum</th></tr></thead><tbody>
          <tr><td>apa yang di-cache</td><td>hasil yang panas, sering dibaca, dan mahal</td></tr>
          <tr><td>cara membaca</td><td>cache-aside: cek, miss → db → isi</td></tr>
          <tr><td>seberapa besar</td><td>hot set, dengan eviction LRU</td></tr>
          <tr><td>kesegaran</td><td>hapus saat tulis + TTL sebagai jaring pengaman</td></tr>
          <tr><td>stampede</td><td>single-flight, jitter TTL, stale-while-revalidate</td></tr></tbody></table>`,
        'Uji dirimu: hit rate turun dari 95% ke 85%. Berapa kali beban database naik? (Miss naik dari 5% ke 15% — tiga kali lipat bebannya.)',
      ],
    },
  ],
};

export default overlay;
