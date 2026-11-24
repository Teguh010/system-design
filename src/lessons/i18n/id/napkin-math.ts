import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Hitungan Kasar (Napkin Math)',
  summary: 'Ubah brief produk menjadi request per detik, jumlah server, terabyte, dan bandwidth — dengan hitungan yang muat di selembar serbet.',
  metrics: ['rata² req / s', 'puncak req / s', 'server', 'storage / tahun', 'egress'],
  goals: [
    'Mengubah jumlah user harian menjadi request per detik',
    'Merancang untuk puncak, bukan rata-rata',
    'Memperkirakan jumlah server dan storage',
    'Memperkirakan bandwidth dan memori',
    'Mengenal beberapa angka yang layak dihafal',
  ],
  labels: {
    upload: 'upload',
    'cache miss / origin fetch': 'cache miss / ambil dari origin',
    '5M daily users': '5 jt user harian',
    'one server?': 'satu server?',
    'peak ≈ 4,500 / s': 'puncak ≈ 4.500 / s',
    'The brief: Cookbook': 'Brief: Cookbook',
    '5M daily active users': '5 jt user aktif harian',
    'each makes ~30 requests a day': 'masing-masing ~30 request sehari',
    'each views ~20 photos a day': 'masing-masing melihat ~20 foto sehari',
    '200k new recipes a day, 1 photo (3 MB)': '200rb resep baru sehari, 1 foto (3 MB)',
    'one server? how much disk?': 'satu server? butuh disk berapa?',
    'Requests per second': 'Request per detik',
    '5M × 30      = 150M / day': '5 jt × 30    = 150 jt / hari',
    '1 day        ≈ 10⁵ s': '1 hari       ≈ 10⁵ s',
    '150M / 10⁵   ≈ 1,500 / s': '150 jt / 10⁵ ≈ 1.500 / s',
    Peak: 'Puncak',
    'evenings   ≈ 3 × average': 'malam hari ≈ 3 × rata-rata',
    '1,500 × 3  ≈ 4,500 / s': '1.500 × 3  ≈ 4.500 / s',
    'launches & holidays: more': 'peluncuran & libur: lebih tinggi',
    Servers: 'Server',
    '1 server   ≈ 1,000 req/s': '1 server   ≈ 1.000 req/s',
    '4,500 / 1,000 ≈ 5 at 100%': '4.500 / 1.000 ≈ 5 di 100%',
    'at 70% → 7, +1 spare': 'di 70% → 7, +1 cadangan',
    '~8 servers': '~8 server',
    '8 × app server': '8 × server aplikasi',
    'recipe db': 'db resep',
    '~365 GB / year': '~365 GB / tahun',
    'object storage': 'object storage',
    '~220 TB / year': '~220 TB / tahun',
    Storage: 'Storage',
    'photos   200k × 3 MB = 600 GB/day': 'foto     200rb × 3 MB = 600 GB/hari',
    '         × 365       ≈ 220 TB/yr': '         × 365        ≈ 220 TB/thn',
    'recipes  200k × 5 KB = 1 GB/day': 'resep    200rb × 5 KB = 1 GB/hari',
    '         × 365       ≈ 365 GB/yr': '         × 365        ≈ 365 GB/thn',
    'resized photos': 'foto yang diperkecil',
    Egress: 'Egress',
    '5M × 20 × 3 MB  = 300 TB / day': '5 jt × 20 × 3 MB = 300 TB / hari',
    '≈ 24 Gbit/s before the peak': '≈ 24 Gbit/s sebelum puncak',
    'hot 20% ≈ 75 GB': '20% terpanas ≈ 75 GB',
    'Cache size': 'Ukuran cache',
    'recipe data / year   365 GB': 'data resep / tahun   365 GB',
    'hot 20%              ~75 GB': '20% terpanas         ~75 GB',
    'one cache node       64–256 GB': 'satu node cache      64–256 GB',
    'fits on 1–2 nodes': 'muat di 1–2 node',
    'Worth memorising': 'Layak dihafal',
    'RAM read              100 ns': 'baca RAM              100 ns',
    'SSD random read       100 µs': 'baca acak SSD         100 µs',
    'round trip, same DC   0.5 ms': 'round trip, DC sama   0,5 ms',
    'HDD seek              10 ms': 'seek HDD              10 ms',
    'round trip, US ↔ EU   80 ms': 'round trip, AS ↔ Eropa 80 ms',
    '1 day ≈ 10⁵ s   1 year ≈ 3 × 10⁷ s': '1 hari ≈ 10⁵ s   1 tahun ≈ 3 × 10⁷ s',
    '~1,500': '~1.500',
    '~4,500': '~4.500',
  },
  steps: [
    {
      short: 'Pertanyaannya',
      title: 'Satu server, atau seratus?',
      body: [
        'Kamu sedang merancang <b>Cookbook</b>, aplikasi berbagi resep. Sebelum memilih database atau menggambar kotak-kotak, kamu perlu punya gambaran skalanya: apakah ini satu mesin, atau sekumpulan mesin?',
        'Hitungan kasar (napkin math) memberimu orde besarnya dalam hitungan menit. Bulatkan dengan berani, simpan satu angka penting saja, dan cukup pedulikan apakah jawabannya 10, 100, atau 1.000.',
      ],
      callout: 'Ketepatan bukan tujuannya. Meleset dua atau tiga kali lipat pun sudah cukup untuk memilih arsitektur.',
    },
    {
      short: 'Request / s',
      title: 'Dari jumlah user ke request per detik',
      body: [
        'Kalikan user dengan aksinya: 5 juta × 30 = 150 juta request sehari. Satu hari punya 86.400 detik; anggap saja <b>100.000 (10⁵)</b> supaya pembagiannya gampang.',
        '150 juta ÷ 100.000 ≈ <b>1.500 request per detik</b> secara rata-rata. Membulatkan hari ke atas membuat perkiraan sedikit kekecilan, tapi tidak masalah — langkah berikutnya menambahkan faktor pengali yang besar.',
      ],
    },
    {
      short: 'Puncak',
      title: 'Rancang untuk puncak',
      body: [
        'Trafik tidak pernah datar. Orang memasak di malam hari, dan resep yang viral di hari Minggu bisa melipatgandakannya lagi. Aturan praktis yang umum: <b>puncak ≈ 2–3 × rata-rata</b>. Sistem harus bertahan di puncak, bukan di rata-rata.',
        'Di sini hasilnya sekitar <b>4.500 request per detik</b>. Tuliskan asumsinya — angka inilah yang paling layak ditinjau ulang begitu trafik sungguhan datang.',
      ],
    },
    {
      short: 'Server',
      title: 'Butuh berapa server?',
      body: [
        'Server API stateless di hardware modern menangani antara beberapa ratus sampai beberapa ribu request sederhana per detik. Pakai <b>1.000</b> sebagai angka perencanaan, lalu cek nanti dengan load test.',
        '4.500 ÷ 1.000 ≈ 5 server yang bekerja habis-habisan. Kamu tidak mau bekerja habis-habisan (ingat titik tekuk pada kurva), jadi targetkan sekitar 70%: kira-kira 7, ditambah satu cadangan supaya crash atau deploy tidak membuatmu kewalahan. <b>Sekitar delapan server</b> — armada kecil, bukan satu mesin dan bukan seratus.',
      ],
    },
    {
      short: 'Storage',
      title: 'Butuh storage berapa?',
      body: [
        'Foto mendominasi: 200.000 sehari × 3 MB = 600 GB sehari, atau sekitar <b>220 TB setahun</b>. Itu tempatnya di object storage seperti S3, bukan di database.',
        'Teks resep dan metadata — katakanlah 5 KB masing-masing — hanya menambah sekitar 1 GB sehari, kira-kira 365 GB setahun, yang bisa ditangani database biasa dengan nyaman. Memisahkan blob besar yang sederhana dari baris kecil yang terstruktur adalah salah satu hasil paling umum dari perkiraan storage.',
      ],
    },
    {
      short: 'Bandwidth',
      title: 'Bandwidth: di mana byte-nya berada',
      body: [
        'Byte terbanyak ada di sisi baca: 5 juta user × 20 foto × 3 MB ≈ 300 TB dikirim per hari — sekitar <b>3 GB per detik</b> secara rata-rata, atau 24 Gbit/s, dan lebih tinggi lagi saat puncak.',
        'Segelintir server aplikasi tidak seharusnya mengirim sebanyak itu. Layani gambar dari <b>CDN</b>, dan simpan versi yang sudah diperkecil: layar ponsel jarang butuh file asli 3 MB kalau versi 200 KB terlihat sama saja. Memperkecil gambar saja sudah memangkas egress sekitar 15×.',
      ],
      callout: 'Perkiraan bandwidth biasanya menjadi alasan utama kenapa CDN dan resize gambar diperlukan.',
    },
    {
      short: 'Memori',
      title: 'Apa yang muat di memori?',
      body: [
        'Jumlah tayangan mengikuti power law: sebagian kecil resep mendapat sebagian besar trafik. Kalau 20% data resep terpanas dalam setahun — sekitar 75 GB — disimpan di memori, sebagian besar pembacaan tidak pernah menyentuh database.',
        '75 GB muat di satu atau dua node cache. Hitungan dua baris mengubah pertanyaan “apakah kita butuh lapisan cache raksasa?” menjadi “cukup beberapa mesin Redis”.',
      ],
    },
    {
      short: 'Angka',
      title: 'Angka yang layak dihafal',
      body: [
        'Segelintir angka memungkinkanmu melakukan sebagian besar perkiraan di kepala. Jarak di antara angka-angka itulah intinya: RAM sekitar seribu kali lebih cepat daripada membaca SSD, dan satu round trip menyeberangi samudra memakan waktu setara hampir sejuta kali membaca memori.',
        'Gabungkan dengan dua konversi waktu dan pangkat sepuluh, dan kamu bisa memeriksa kewajaran sebagian besar klaim desain dalam satu menit.',
      ],
    },
    {
      short: 'Rangkuman',
      title: 'Dari brief ke kotak-kotak',
      body: [
        'Lima baris hitungan menghasilkan sebagian besar arsitekturnya:',
        `<table class="compare"><thead><tr><th>perkiraan</th><th>hasil</th><th>jadi desainnya butuh</th></tr></thead><tbody>
          <tr><td>beban rata-rata</td><td>~1.500 req/s</td><td>lebih dari satu server</td></tr>
          <tr><td>beban puncak</td><td>~4.500 req/s</td><td>~8 server stateless + load balancer</td></tr>
          <tr><td>storage foto</td><td>~220 TB / tahun</td><td>object storage, bukan database</td></tr>
          <tr><td>data resep</td><td>~365 GB / tahun</td><td>satu database biasa</td></tr>
          <tr><td>egress</td><td>~3 GB/s</td><td>CDN dan gambar yang diperkecil</td></tr>
          <tr><td>data panas</td><td>~75 GB</td><td>cache kecil</td></tr></tbody></table>`,
        'Uji dirimu: kalau Cookbook tumbuh menjadi 50 juta user harian, kotak mana yang paling berubah? (Bandwidth dan storage naik 10×; CDN dan object storage menyerapnya, sementara lapisan aplikasi tumbuh menjadi sekitar 80 server.)',
      ],
      callout: 'Perkirakan dulu, lalu rancang agar sesuai dengan angkanya — jangan sebaliknya.',
    },
  ],
};

export default overlay;
