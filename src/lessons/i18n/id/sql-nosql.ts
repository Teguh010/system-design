import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'SQL vs NoSQL',
  summary:
    'Aplikasi tiket konser menunjukkan kapan relasi dan transaksi ACID wajib — dan kapan document store lebih pas — karena pola akses yang memilih database.',
  metrics: ['sumber kebenaran', 'risiko double-book', 'query ad-hoc'],
  goals: [
    'Melihat kenapa “satu database untuk semua” gagal pada kursi',
    'Memakai baris, kunci, dan transaksi untuk melindungi inventori',
    'Mengenali beban kerja yang ingin dokumen fleksibel',
    'Menyadari duplikasi saat dua store tidak selaras',
    'Memilih storage dari cara kamu baca dan menulis data',
  ],
  labels: {
    race: 'kondisi race',
    fans: 'penggemar',
    'ticket API': 'API tiket',
    PostgreSQL: 'PostgreSQL',
    'seats · orders': 'kursi · pesanan',
    'document store': 'document store',
    'event catalog': 'katalog event',
    'B12 × 2': 'B12 × 2',
    'B12 free ×2': 'B12 bebas ×2',
    writes: 'tulis',
    'Relational sketch': 'Sketsa relasional',
    'events   id, name, starts_at': 'events   id, name, starts_at',
    'seats    event_id, row, seat, status': 'seats    event_id, row, seat, status',
    'orders   id, seat_id, fan_email': 'orders   id, seat_id, fan_email',
    'UNIQUE (event_id, row, seat)': 'UNIQUE (event_id, row, seat)',
    'txn holds lock': 'txn pegang lock',
    'lock wait': 'tunggu lock',
    'BEGIN … COMMIT': 'BEGIN … COMMIT',
    '42 nullable cols': '42 kolom nullable',
    'Marketing fields': 'Field marketing',
    bio_html: 'bio_html',
    'tags[]': 'tags[]',
    hero_assets: 'hero_assets',
    experiments: 'experiments',
    'not seat inventory': 'bukan inventori kursi',
    'by slug': 'per slug',
    checkout: 'checkout',
    'GET /events/{slug}': 'GET /events/{slug}',
    'starts 19:00': 'mulai 19.00',
    'starts 20:00': 'mulai 20.00',
    'source: SQL': 'sumber: SQL',
    'stale doc': 'dokumen basi',
    authoritative: 'otoritatif',
    'derived view': 'tampilan turunan',
    'sync job': 'job sync',
    Ownership: 'Kepemilikan',
    'seats/orders → SQL': 'kursi/pesanan → SQL',
    'pages/tags → documents': 'halaman/tag → documents',
    'publish → copy fields once': 'publish → salin field sekali',
    'txn/s': 'txn/dtk',
    'reads/s': 'baca/dtk',
    'seats safe': 'kursi aman',
    'pages flexible': 'halaman fleksibel',
    'one database': 'satu database',
    'oversold seats': 'kursi oversold',
    'read → write gap': 'celah baca → tulis',
    'normalized tables': 'tabel normal',
    'serialized seats': 'kursi diserialkan',
    'wide rows hurt': 'baris lebar menyakitkan',
    'SQL + documents': 'SQL + documents',
    'shape per page': 'bentuk per halaman',
    'metadata drift': 'metadata menyimpang',
    'owned fields': 'field yang dimiliki',
    'pattern-first': 'pola dulu',
  },
  steps: [
    {
      short: 'Oversold',
      title: 'Dua penggemar, satu kursi',
      body: [
        'Nova Hall menjual tiket untuk show comeback. Dalam hitungan menit media sosial penuh screenshot: dua email konfirmasi berbeda untuk <b>kursi B12</b>. Tim support melihat kedua pesanan di ekspor spreadsheet — show-nya oversold.',
        'Tim membangun <code>nova-tickets</code> di satu API dan satu database. Terasa cepat untuk launch. Sekarang mereka perlu paham jenis database apa yang benar-benar cocok dengan cara tiket dibeli.',
      ],
    },
    {
      short: 'Race',
      title: 'Kasus: checkout tanpa transaksi',
      body: [
        'Checkout dua langkah: baca apakah kursi B12 bebas, lalu sisipkan baris pesanan. Dua penggemar klik “Beli” di detik yang sama. Kedua pembacaan melihat “bebas”. Kedua insert berhasil — bug yang baru kamu lihat.',
        'Ini <b>race</b>: hasilnya bergantung pada timing, bukan aturan bisnis. Memperbaikinya bukan “hati-hati di kode”; store harus membuat update bentrok mustahil.',
      ],
      callout: 'Kalau dua penulis bisa melewati urutan cek-lalu-tulis yang sama, kamu butuh atomicity dari database atau lock eksplisit.',
      changes: ['+ dua request checkout sekaligus', '~ status kursi dicek terpisah dari insert'],
    },
    {
      short: 'Relasional',
      title: 'Modelkan aturan di tabel',
      body: [
        'Model <b>relasional</b> cocok untuk inventori: baris <code>events</code>, banyak baris <code>seats</code> per event, dan baris <code>orders</code> yang merujuk tepat satu kursi. Foreign key menghentikan orphan; uniqueness pada <code>(event_id, seat)</code> menghentikan duplikat saat diam.',
        'Diagram menunjukkan bentuk yang akan di-query app: “apakah kursi ini taken?” jadi satu join atau lookup by key, bukan scan blob.',
      ],
      changes: ['+ tabel events · seats · orders', '+ uniqueness per kursi per event'],
    },
    {
      short: 'ACID',
      title: 'Bungkus checkout dalam transaksi',
      body: [
        'API membuka <b>transaksi</b>: <code>BEGIN</code>, kunci kursi B12 (<code>SELECT … FOR UPDATE</code>), insert pesanan, <code>COMMIT</code>. Transaksi penggemar kedua tertahan sampai yang pertama selesai, lalu melihat “taken” dan rollback.',
        'Bundel itu jaminan <b>ACID</b> yang didesain mesin relasional: kursi tidak bisa terjual dua kali, bahkan di bawah beban. Latency sedikit naik di kursi panas, tapi kebenaran menang.',
      ],
      callout: 'Pilih SQL saat beberapa baris harus bergerak bersama dan invariant harus selalu benar.',
      changes: ['~ checkout jadi satu unit atomik', '~ pembeli kedua menunggu atau gagal rapi'],
    },
    {
      short: 'Analitik',
      title: 'Kasus: marketing ingin katalog hidup',
      body: [
        'Overselling sudah beres, tapi produk ingin katalog yang bisa dijelajahi: pencarian fuzzy pada bio artis, tag JSON, gambar hero, dan copy A/B — field yang berubah mingguan dan tidak butuh join ke kursi.',
        'Memaksanya ke puluhan kolom SQL nullable membuat migrasi menyakitkan. Bacaannya “ambil dokumen per slug”; tulisnya “ganti seluruh halaman”. Itu pola akses berbeda dari checkout.',
      ],
      changes: ['+ halaman katalog sering berubah', '~ bacaannya dokumen utuh per id'],
    },
    {
      short: 'Dokumen',
      title: 'Simpan katalog sebagai dokumen',
      body: [
        'Mereka menambah database <b>document</b> untuk katalog marketing: satu dokumen JSON per halaman event, diberi versi sendiri. API tiket tetap memakai PostgreSQL untuk kursi; trafik browse ke document store.',
        '<b>NoSQL</b> di sini bukan “tanpa aturan” — artinya skema fleksibel di dalam tiap dokumen dan kamu optimalkan lookup by key, bukan join bebas.',
      ],
      changes: ['+ document DB hanya untuk katalog', '~ baris tiket tetap di SQL'],
    },
    {
      short: 'Drift',
      title: 'Kasus: dua sumber kebenaran menyimpang',
      body: [
        'Typo di kolom SQL <code>events.starts_at</code> diperbaiki untuk checkout, tapi marketing lupa memperbarui dokumen katalog. Penggemar melihat “20.00” di web dan “19.00” di PDF tiket.',
        'Memecah store menukar fleksibilitas dengan <b>konsistensi antar sistem</b>. Kamu butuh satu penulis, job sinkronisasi, atau menerima bahwa beberapa field otoritatif hanya di satu tempat.',
      ],
      callout: 'Setiap database tambahan adalah tempat lain data bisa tidak selaras kecuali kamu mendesain kepemilikan.',
      changes: ['~ jam mulai beda per store', '~ penggemar melihat copy bentrok'],
    },
    {
      short: 'Polyglot',
      title: 'Polyglot persistence',
      body: [
        'Perbaikannya kepemilikan eksplisit: PostgreSQL adalah <b>sumber kebenaran</b> untuk apa pun yang bisa oversell kursi; DB katalog dibangun ulang dari event bus atau job malam. Marketing mengedit dokumen draf, lalu publish mendorong field kanonik ke bawah.',
        'Kebanyakan produk nyata seperti ini — bukan “SQL <i>atau</i> NoSQL”, tapi SQL <i>di mana transaksi penting</i> dan dokumen <i>di mana bentuknya fluid</i>.',
      ],
      changes: ['+ pipeline publish menyinkronkan jam', '~ katalog diturunkan, bukan otoritatif untuk kursi'],
    },
    {
      short: 'Pilih',
      title: 'Biarkan pola akses yang memilih',
      body: [
        'Tanya bagaimana data <b>dibaca</b> dan <b>ditulis</b>, bukan logo mana yang lagi trend. Banyak baris terkait yang harus bergerak bersama → relasional + transaksi. Baca objek utuh, field berkembang, skala besar pada key sederhana → document atau wide-column.',
        'Cache key-value dan indeks pencarian adalah spesialisasi lain; mereka duduk di samping system of record, bukan menggantikannya.',
      ],
    },
    {
      short: 'Recap',
      title: 'Recap',
      body: [
        'Cerita Nova Hall dalam satu tabel:',
        `<table class="compare"><thead><tr><th>kebutuhan</th><th>cenderung</th><th>kenapa</th><th>lihat</th></tr></thead><tbody>
          <tr><td>tidak double-selling kursi</td><td class="good">SQL + ACID</td><td>lock + constraint</td><td>lesson ini</td></tr>
          <tr><td>halaman marketing fleksibel</td><td class="good">documents</td><td>baca objek utuh</td><td>lesson ini</td></tr>
          <tr><td>keduanya sekaligus</td><td>dua store + sync</td><td>pola berbeda</td><td>replication</td></tr>
          <tr><td>lookup lebih cepat</td><td>indexes</td><td>hindari full scan</td><td>indexes</td></tr></tbody></table>`,
        'Check yourself: checkout tidak boleh menjual VIP terakhir dua kali, tapi blurb “tentang artis” berubah tiap hari. Satu database atau dua, dan siapa pemilik field apa? (Dua: SQL memegang pass; documents memegang copy marketing; sinkronkan jam publish dari SQL.)',
      ],
    },
  ],
};

export default overlay;