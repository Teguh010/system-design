import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Replikasi',
  summary:
    'Aplikasi bookmark melampaui satu Postgres — tambah read replica, terima replication lag, dan latih failover tanpa membuat penulis kedua.',
  metrics: ['replication lag', 'baca diarahkan', 'leader hilang →'],
  goals: [
    'Mengirim tulis ke satu leader dan baca ke tempat lain',
    'Melihat data basi saat replikasi lag',
    'Membandingkan replikasi async vs sync',
    'Mempromosikan replica saat leader mati',
    'Memahami arti RPO dan RTO secara praktis',
  ],
  labels: {
    'stale read': 'baca basi',
    readers: 'pembaca',
    'API fleet': 'armada API',
    '3 instances': '3 instance',
    primary: 'primary',
    'writes only': 'hanya tulis',
    leader: 'leader',
    'read replica': 'read replica',
    promoted: 'dipromosikan',
    'async follower': 'pengikut async',
    'new leader': 'leader baru',
    replica: 'replica',
    standby: 'standby',
    'other AZ': 'AZ lain',
    'read I/O': 'I/O baca',
    'read-only': 'read-only',
    'SELECT feed': 'SELECT feed',
    writes: 'tulis',
    reads: 'baca',
    'WAL stream': 'alur WAL',
    'sync repl': 'repl sync',
    lag: 'lag',
    behind: 'tertinggal',
    'caught up': 'sudah menyusul',
    'write wait': 'tunggu tulis',
    DOWN: 'MATI',
    timeout: 'timeout',
    'writes now': 'tulis sekarang',
    'Failover rules': 'Aturan failover',
    'one writable leader': 'satu leader bisa tulis',
    'fence old node': 'pagar node lama',
    'never two primaries': 'jangan dua primary',
    'DR copy': 'salinan DR',
    'async DR': 'DR async',
    'read scale': 'skala baca',
    'write path': 'jalur tulis',
    '100% primary': '100% primary',
    '70% replica': '70% replica',
    '80% replica': '80% replica',
    '~200 ms': '~200 ms',
    '200 ms': '200 ms',
    '~0 ms': '~0 ms',
    'promote replica': 'promosikan replica',
    'RTO ~3 min': 'RTO ~3 mnt',
    '?': '?',
    '—': '—',
  },
  steps: [
    {
      short: 'Baca panas',
      title: 'Feed membuat database panas',
      body: [
        'Shelfmark memungkinkan orang menyimpan artikel dan menggulir feed tanpa batas. **Jutaan pembaca**, lebih sedikit penulis — tapi setiap gulir memukul Postgres yang sama dengan <code>SELECT</code> sementara sedikit insert memperbarui timeline.',
        'CPU baik pada tulis; **I/O baca menempel 100%**. Indeks dari lesson lalu membantu lookup tunggal, tapi menampilkan feed tetap membaca ribuan baris per request.',
      ],
    },
    {
      short: 'Replica',
      title: 'Tambahkan read replica',
      body: [
        'Perbaikan pertama yang semua orang coba: pertahankan **primary** untuk tulis, tambah **replica** yang terus menyalin data dan melayani query read-only. Belum ada sumber kebenaran kedua — hanya salinan hangat di mesin lain.',
        'Armada API harus belajar dua connection string: <code>PRIMARY</code> untuk mutasi, <code>REPLICA</code> untuk feed dan pencarian.',
      ],
      changes: ['+ instance Postgres kedua', '~ baca bisa ditujukan ke replica'],
    },
    {
      short: 'Leader',
      title: 'Satu leader untuk tulis',
      body: [
        'Hanya **leader** yang menerima <code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>. Replica menerapkan perubahan yang sama berurutan lewat write-ahead log — tidak pernah memulai mutasi, atau kamu risk dua riwayat yang menyimpang.',
        'Server app Shelfmark berbagi aturan routing: mutasi ke `leader`; sisanya bisa ke `replica` sampai konsistensi penting.',
      ],
      callout: 'Replikasi menyalin leader yang ada. Tidak mengganti protokol konsensus saat dua node bisa menerima tulis.',
      changes: ['~ tulis terkunci ke leader', '~ replica menerapkan log berurutan'],
    },
    {
      short: 'Async',
      title: 'Replikasi asinkron',
      body: [
        'Default replikasi **asinkron**: leader mengakui simpan sebelum WAL dikirim ke replica. p95 **replication lag** Shelfmark sekitar 200 ms — biasanya tak terlihat di feed, terkadang terlihat.',
        'Lag itu jendela saat replica tertinggal. Tulis sukses cepat; pembaca di replica mungkin melihat jumlah bookmark kemarin.',
      ],
      changes: ['+ pengiriman WAL async', '~ leader tidak menunggu fsync replica'],
    },
    {
      short: 'Basi',
      title: 'Kasus: tersimpan, feed masih kosong',
      body: [
        'User mengetuk “Simpan” dan dapat 201 dari leader. Mereka tarik untuk refresh; API feed membaca replica dan baris baru belum tiba. Selama dua ratus milidetik UI tampak rusak.',
        'Ini **baca basi**. Perbaikan: routing read-your-writes (sementara tempel user ke primary), atau replikasi sync untuk jalur kritis, atau UI optimistik sampai replica menyusul.',
      ],
      callout: 'Kalau klien membaca dari replica, kamu harus memutuskan apa yang dilakukan saat lag — abaikan, samarkan, atau bayar sync.',
      changes: ['~ user refresh di jendela lag', '~ replica belum punya baris terbaru'],
    },
    {
      short: 'Sync',
      title: 'Replikasi sinkron',
      body: [
        'Untuk baris “uang”, Shelfmark mengaktifkan replikasi **sinkron**: leader menunggu minimal satu replica mengakui sebelum mengonfirmasi tulis. Lag mendekati nol; latency tulis naik karena setiap simpan membayar round trip.',
        'Kamu pilih per transaksi atau seluruh cluster — kebanyakan tim async default, sync hanya di mana baca basi tidak bisa diterima.',
      ],
      changes: ['~ leader menunggu ack replica', '~ p95 tulis +3 ms (ilustratif)'],
    },
    {
      short: 'Failover',
      title: 'Kasus: disk primary mati',
      body: [
        'Satu AZ cloud kehilangan daya. **Leader** berhenti menjawab. Insert gagal sampai seseorang **mempromosikan** replica: berhenti menerapkan sebagai pengikut, terima tulis, rekonfigurasi DNS atau service discovery agar app menemukan leader baru.',
        'Otomasi (Patroni, failover RDS) melakukan ini dalam menit; runbook manual lebih lama. Detik WAL terakhir di leader lama bisa **hilang** jika replikasi async — **RPO**-mu.',
      ],
      changes: ['+ leader ditandai down', '~ replica diangkat jadi penulis'],
    },
    {
      short: 'Split',
      title: 'Hindari dua leader',
      body: [
        'Kegagalan menakutkan adalah **split brain**: dua node sama-sama percaya mereka primary dan menerima tulis. Data menyimpang dan merge menyakitkan. Runbook memakai STONITH (pagar leader lama), konsensus (Raft — lihat <i>Consensus</i>), atau API cloud yang menjamin hanya satu endpoint writable.',
        'Replica adalah salinan, bukan pemilih. Promosi harus langkah terkoordinasi dan disengaja.',
      ],
      changes: ['~ aturan failover: satu penulis'],
    },
    {
      short: 'RPO/RTO',
      title: 'Ukur pemulihan dalam waktu dan data',
      body: [
        '**RPO** (recovery point objective): berapa banyak data yang boleh hilang — WAL yang tidak ter-replikasi sebelum crash. Async bisa detik; sync bisa nol.',
        '**RTO** (recovery time objective): berapa lama sampai layanan kembali. Replica panas di region sama = menit; restore dari backup pita = jam. Shelfmark menyimpan **standby** di AZ lain untuk latihan DR.',
      ],
      changes: ['+ standby di AZ kedua', '~ DR diukur sebagai RPO / RTO'],
    },
    {
      short: 'Recap',
      title: 'Recap',
      body: [
        'Contekan replikasi Shelfmark:',
        `<table class="compare"><thead><tr><th>tujuan</th><th>pola</th><th>biaya</th><th>lihat</th></tr></thead><tbody>
          <tr><td>skala baca</td><td class="good">read replica</td><td>basisan</td><td>lesson ini</td></tr>
          <tr><td>tanpa baca basi</td><td>replikasi sync</td><td>tulis lebih lambat</td><td>lesson ini</td></tr>
          <tr><td>selamat dari AZ mati</td><td>promosi + standby</td><td>RPO / RTO</td><td>redundancy</td></tr>
          <tr><td>pecah data</td><td>sharding</td><td>kompleksitas ops</td><td>sharding</td></tr></tbody></table>`,
        'Check yourself: feed boleh basi 200 ms; saldo akun tidak boleh. Satu pool replica atau arahkan query saldo ke standby sync? (Arahkan saldo ke leader atau replica sync; feed tetap di replica async.)',
      ],
    },
  ],
};

export default overlay;