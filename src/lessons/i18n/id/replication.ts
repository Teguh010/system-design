import type { LessonOverlay } from '../../../types.ts';

const overlay: LessonOverlay = {
  title: 'Replikasi',
  summary:
    'Aplikasi bookmark melampaui satu Postgres — tambah read replica, terima replication lag, dan latih failover tanpa membuat penulis kedua.',
  metrics: ['replication lag', 'baca di primary', 'leader hilang →'],
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
    '2M/day': '2 jt/hari',
    'API fleet': 'armada API',
    '3 instances': '3 instance',
    Postgres: 'Postgres',
    'solo copy': 'satu salinan',
    unreachable: 'tak terjangkau',
    leader: 'leader',
    follower: 'follower',
    promoted: 'dipromosikan',
    'new leader': 'leader baru',
    WAL: 'WAL',
    'replication log': 'log replikasi',
    'follower only': 'hanya follower',
    '100% leader': '100% leader',
    standby: 'standby',
    'other AZ': 'AZ lain',
    'read I/O': 'I/O baca',
    'read-only': 'read-only',
    'SELECT feed': 'SELECT feed',
    writes: 'tulis',
    reads: 'baca',
    'all traffic': 'semua trafik',
    'On-call': 'On-call',
    'read I/O 100%': 'I/O baca 100%',
    'write latency OK': 'latency tulis OK',
    'single Postgres': 'satu Postgres',
    'WAL stream': 'alur WAL',
    'sync repl': 'repl sync',
    lag: 'lag',
    behind: 'tertinggal',
    'caught up': 'sudah menyusul',
    'write wait': 'tunggu tulis',
    'stale feed': 'feed basi',
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
    '100%': '100%',
    '~30%': '~30%',
    '~20%': '~20%',
    '~200 ms': '~200 ms',
    '200 ms': '200 ms',
    '~0 ms': '~0 ms',
    'promote replica': 'promosikan replica',
    'RTO ~3 min': 'RTO ~3 mnt',
    '?': '?',
    '—': '—',
    'writes fail': 'tulis gagal',
  },
  steps: [
    {
      short: 'Satu DB',
      title: 'Satu database, tiap gulir',
      body: [
        'Shelfmark melayani jutaan gulir feed per hari. Hampir semua trafik <code>SELECT</code>; simpan dan unfollow tipis. Tapi setiap gulir tetap memukul Postgres yang sama — tidak ada tempat lain.',
        'CPU tulis masih nyaman; <b>I/O baca jenuh</b>. Pager on-call bukan “tulis gagal” — melainkan “disk tidak sanggup mengikuti baca”.',
      ],
      callout: 'Kebanyakan produk lebih banyak baca daripada tulis. Satu mesin untuk kedua peran mencapai langit-langit baca jauh sebelum CPU tulis.',
    },
    {
      short: 'Replica',
      title: 'Tambahkan salinan follower',
      body: [
        'Langkah skala pertama: pertahankan <b>leader</b> untuk tulis, tambah <b>follower</b> (Postgres menyebutnya read replica) yang mengikuti WAL dan menjawab query read-only. Shelfmark mengarahkan feed dan pencarian ke follower.',
        'Armada API butuh dua pool: endpoint leader untuk mutasi, endpoint follower untuk trafik read-mostly.',
      ],

      changes: ['+ follower (salinan hangat)', '~ feed bisa ke follower'],
    },
    {
      short: 'Routing',
      title: 'Baca ke follower, tulis ke leader',
      body: [
        'Sekarang app mengirim <b>baca ke follower</b> dan <b>tulis hanya ke leader</b>. I/O baca leader turun; follower menampung gulir. Butuh kapasitas baca lebih? Tambah follower — masing-masing salinan read-only.',
        'Follower menerapkan WAL leader berurutan. Tidak menerima mutasi, atau riwayat menyimpang. Cocok untuk read-heavy; write-heavy tetap bottleneck di satu leader.',
      ],
      callout: 'Replikasi menyalin leader yang ada. Tidak mengganti konsensus saat dua node bisa menerima tulis.',
      chaos: {
        leader:
          'Tulis gagal langsung — tidak ada node writable lain. Baca di follower masih jalan, tapi membeku di byte terakhir yang ter-replikasi. Shelfmark tidak bisa menyimpan bookmark baru sampai failover.',
        replica:
          'Baca gagal untuk feed dan pencarian, tapi leader masih menerima simpan. Trafik menumpuk lagi di leader — I/O baca naik sampai follower dipulihkan.',
      },
      changes: ['~ baca → follower', '~ tulis → leader saja', '~ I/O baca leader 98% → 30%'],
    },
    {
      short: 'Async',
      title: 'Replikasi asinkron',
      body: [
        'Replikasi default <b>asinkron</b>: leader mengakui simpan sebelum WAL dikirim ke replica. p95 <b>replication lag</b> Shelfmark ~200 ms — tidak terlihat di feed santai, terlihat tepat setelah “Simpan”.',
        'Lag itu jendela saat replica tertinggal. Tulis tetap cepat; pembaca di replica bisa melihat timeline lebih lama.',
      ],
      changes: ['+ pengiriman WAL async', '~ leader tidak menunggu fsync follower'],
    },
    {
      short: 'Basi',
      title: 'Kasus: tersimpan, feed masih kosong',
      body: [
        'User mengetuk “Simpan” dan mendapat <code>201 Created</code> dari leader. Tarik refresh; API feed membaca follower dan baris belum ada. ~200 ms UI tampak rusak.',
        'Itu <b>baca basi</b>. Mitigasi: routing read-your-writes (sementara tempel user ke primary), replikasi sync untuk baris uang, atau UI optimistik sampai replica menyusul.',
      ],
      callout: 'Kalau klien membaca dari follower, kamu harus memutuskan saat lag — abaikan, samarkan, atau bayar sync.',
      changes: ['~ refresh ke follower saat lag', '~ baris terbaru belum terlihat'],
    },
    {
      short: 'Sync',
      title: 'Replikasi sinkron',
      body: [
        'Untuk saldo dan tagihan, Shelfmark mengaktifkan replikasi <b>sinkron</b>: leader menunggu minimal satu follower mengakui sebelum mengonfirmasi tulis. Lag mendekati nol; setiap commit membayar round trip.',
        'Kebanyakan tim default async dan sync hanya di mana baca basi tidak bisa diterima.',
      ],

      changes: ['~ leader menunggu ack follower', '~ p95 tulis +3 ms (ilustratif)'],
    },
    {
      short: 'Failover',
      title: 'Kasus: disk primary mati',
      body: [
        'Satu AZ kehilangan daya. <b>Leader</b> berhenti menjawab. Insert gagal sampai ops <b>mempromosikan</b> follower: keluar mode read-only, terima tulis, arahkan app ke leader baru.',
        'Otomasi (Patroni, failover RDS) melakukan ini dalam menit; runbook manual lebih lama. WAL belum terkirim bisa <b>hilang</b> dengan async — <b>RPO</b>-mu.',
      ],
      changes: ['+ leader ditandai down', '~ follower dipromosikan jadi leader'],
    },
    {
      short: 'Split',
      title: 'Hindari dua leader',
      body: [
        'Mimpi buruk adalah <b>split brain</b>: dua node sama-sama percaya mereka primary dan menerima tulis. Data menyimpang; merge menyakitkan. Runbook memakai fencing (STONITH), konsensus (Raft — lihat <i>Consensus</i>), atau API cloud yang menegakkan satu endpoint writable.',
        'Follower adalah salinan, bukan pemilih. Promosi harus disengaja dan terkoordinasi.',
      ],
      changes: ['~ aturan: tepat satu penulis'],
    },
    {
      short: 'RPO/RTO',
      title: 'Ukur pemulihan dalam waktu dan data',
      body: [
        '<b>RPO</b> (recovery point objective): berapa banyak data boleh hilang — WAL tidak ter-replikasi sebelum crash. Async bisa detik; sync bisa nol.',
        '<b>RTO</b> (recovery time objective): berapa lama sampai layanan kembali. Replica panas dalam region = menit; backup dingin = jam. Shelfmark menyimpan <b>standby</b> di AZ lain untuk latihan DR.',
      ],
      changes: ['+ standby di AZ kedua', '~ target DR: RPO / RTO'],
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